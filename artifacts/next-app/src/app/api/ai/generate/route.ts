import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkAndIncrementUsage } from "@lib/ai-rate-limit";
import { resolveModel, type TaskType, type Provider } from "@lib/ai-model-router";
import { parseGeminiError } from "@lib/ai-error-handler";
import { db, userApiKeysTable } from "@workspace/db";
import { decryptApiKey } from "@lib/encryption";
import { eq, and } from "drizzle-orm";

const VALID_TASK_TYPES = ["background", "manual", "deliberate"] as const;
const VALID_PROVIDERS: Provider[] = [
  "graphe_free",
  "google_ai_studio",
  "openai",
  "anthropic",
  "local_llm",
];

export async function POST(request: NextRequest) {
  try {
    // --- Auth ---
    const { user } = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // --- Request validation ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
    }

    const { taskType, prompt, context, provider: rawProvider, modelOverride: rawModelOverride } =
      body as Record<string, unknown>;

    const provider: Provider =
      typeof rawProvider === "string" && VALID_PROVIDERS.includes(rawProvider as Provider)
        ? (rawProvider as Provider)
        : "graphe_free";

    if (provider === "local_llm") {
      return NextResponse.json(
        { error: "local_llm_client_only", message: "Local LLM requests must be made directly from the client." },
        { status: 400 },
      );
    }

    if (!taskType || !VALID_TASK_TYPES.includes(taskType as TaskType)) {
      return NextResponse.json(
        {
          error: `Missing or invalid taskType. Must be one of: ${VALID_TASK_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Missing or empty required field: prompt" },
        { status: 400 },
      );
    }

    if (context !== undefined && typeof context !== "string") {
      return NextResponse.json({ error: "context must be a string if provided" }, { status: 400 });
    }

    const modelOverride =
      typeof rawModelOverride === "string" && rawModelOverride.trim()
        ? rawModelOverride.trim()
        : undefined;

    // --- Build prompt ---
    const combinedPrompt = context ? `${prompt}\n${context}` : prompt;

    // --- graphe_free path ---
    if (provider === "graphe_free") {
      const rateLimit = await checkAndIncrementUsage(userId);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: "rate_limit_exceeded",
            reason: rateLimit.reason,
            hourlyUsed: rateLimit.hourlyUsed,
            hourlyLimit: rateLimit.hourlyLimit,
            resetInMs: rateLimit.resetInMs,
          },
          { status: 429 },
        );
      }

      const routing = resolveModel("graphe_free", taskType as TaskType);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is required but not set.",
        );
      }

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${routing.model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: combinedPrompt }] }],
            generationConfig: { maxOutputTokens: 1024 },
          }),
        },
      );

      if (!geminiResponse.ok) {
        const rawErrorBody = await geminiResponse.text();
        const parsedError = parseGeminiError(geminiResponse.status, rawErrorBody);

        if (parsedError.type === "rpm_limit") {
          return NextResponse.json(
            { error: parsedError.type, userMessage: parsedError.userMessage, retryAfterMs: parsedError.retryAfterMs },
            { status: 429 },
          );
        }
        if (parsedError.type === "rpd_limit") {
          return NextResponse.json(
            { error: parsedError.type, userMessage: parsedError.userMessage, retryAfterMs: null },
            { status: 429 },
          );
        }
        if (parsedError.type === "invalid_key") {
          return NextResponse.json(
            { error: parsedError.type, userMessage: parsedError.userMessage },
            { status: 401 },
          );
        }
        return NextResponse.json(
          { error: parsedError.type, userMessage: parsedError.userMessage },
          { status: 502 },
        );
      }

      const data = (await geminiResponse.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const inputTokens = data.usageMetadata?.promptTokenCount ?? null;
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? null;

      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, model: routing.model, input_tokens: inputTokens, output_tokens: outputTokens } });
      return NextResponse.json({
        result,
        model: routing.model,
        tokensUsed: { inputTokens, outputTokens },
      });
    }

    // --- Non-free provider path (no rate limiting) ---
    const rows = await db
      .select()
      .from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.provider, provider)));

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        {
          error: "no_key_configured",
          userMessage: "No API key found for this provider. Please add one in Settings.",
        },
        { status: 400 },
      );
    }

    const decryptedKey = decryptApiKey(row.encryptedKey);

    // Effective model override: request body → db row fallback
    const effectiveModelOverride = modelOverride ?? (row.modelOverride ?? undefined);

    let routing;
    try {
      routing = resolveModel(provider, taskType as TaskType, effectiveModelOverride);
    } catch {
      return NextResponse.json(
        {
          error: "no_model_configured",
          userMessage: "No model configured for this provider. Please set one in Settings.",
        },
        { status: 400 },
      );
    }

    // --- google_ai_studio ---
    if (provider === "google_ai_studio") {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${routing.model}:generateContent?key=${decryptedKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: combinedPrompt }] }],
            generationConfig: { maxOutputTokens: 1024 },
          }),
        },
      );

      if (!geminiResponse.ok) {
        const rawErrorBody = await geminiResponse.text();
        const parsedError = parseGeminiError(geminiResponse.status, rawErrorBody);

        if (parsedError.type === "rpm_limit") {
          return NextResponse.json(
            { error: parsedError.type, userMessage: parsedError.userMessage, retryAfterMs: parsedError.retryAfterMs },
            { status: 429 },
          );
        }
        if (parsedError.type === "rpd_limit") {
          return NextResponse.json(
            { error: parsedError.type, userMessage: parsedError.userMessage, retryAfterMs: null },
            { status: 429 },
          );
        }
        if (parsedError.type === "invalid_key") {
          return NextResponse.json(
            { error: parsedError.type, userMessage: parsedError.userMessage },
            { status: 401 },
          );
        }
        return NextResponse.json(
          { error: parsedError.type, userMessage: parsedError.userMessage },
          { status: 502 },
        );
      }

      const data = (await geminiResponse.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const inputTokens = data.usageMetadata?.promptTokenCount ?? null;
      const outputTokens = data.usageMetadata?.candidatesTokenCount ?? null;

      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, model: routing.model, input_tokens: inputTokens, output_tokens: outputTokens } });
      return NextResponse.json({
        result,
        model: routing.model,
        tokensUsed: { inputTokens, outputTokens },
      });
    }

    // --- openai ---
    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${decryptedKey}`,
        },
        body: JSON.stringify({
          model: routing.model,
          messages: [{ role: "user", content: combinedPrompt }],
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        return NextResponse.json(
          { error: "upstream_error", geminiStatus: response.status, geminiMessage: rawBody },
          { status: 502 },
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const result = data.choices[0]?.message?.content ?? "";
      const tokensUsed = {
        inputTokens: data.usage?.prompt_tokens ?? null,
        outputTokens: data.usage?.completion_tokens ?? null,
      };

      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, model: routing.model, input_tokens: tokensUsed.inputTokens, output_tokens: tokensUsed.outputTokens } });
      return NextResponse.json({ result, model: routing.model, tokensUsed });
    }

    // --- anthropic ---
    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": decryptedKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: routing.model,
          max_tokens: 1024,
          messages: [{ role: "user", content: combinedPrompt }],
        }),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        return NextResponse.json(
          { error: "upstream_error", geminiStatus: response.status, geminiMessage: rawBody },
          { status: 502 },
        );
      }

      const data = (await response.json()) as {
        content: Array<{ text: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const result = data.content[0]?.text ?? "";
      const tokensUsed = {
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
      };

      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, model: routing.model, input_tokens: tokensUsed.inputTokens, output_tokens: tokensUsed.outputTokens } });
      return NextResponse.json({ result, model: routing.model, tokensUsed });
    }

    // local_llm is rejected at the top of this handler — requests must be made client-side.
    // Should never reach here given VALID_PROVIDERS check above.
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
