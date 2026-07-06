import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkAndIncrementUsage } from "@lib/ai-rate-limit";
import { resolveModel, type TaskType, type Provider } from "@lib/ai-model-router";
import { parseGeminiError } from "@lib/ai-error-handler";
import { PROVIDER_ADAPTERS } from "@lib/ai-providers";
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
  // G17 (9.2): OpenAI-compatible BYOK providers.
  "openrouter",
  "groq",
  "mistral",
  "together",
  "fireworks",
  "custom_openai",
];

// SSRF guard (§S / CodeQL js/request-forgery): routing.model can derive from a
// user-supplied modelOverride and is interpolated into the upstream Gemini URL
// path. Allow only bare model-id characters — no slashes, query chars, or `..`
// that could redirect the request or traverse the path.
function isValidModelId(model: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(model);
}

// G4: surfaced (via userMessage) when the model hit its output-token cap
// mid-response, so the client shows a friendly error instead of a silent cut.
const TRUNCATION_MESSAGE =
  "The AI response was too long and got cut off. Try selecting less text or asking for a shorter result.";

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
      if (!isValidModelId(routing.model)) {
        return NextResponse.json({ error: "Invalid model" }, { status: 400 });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is required but not set.",
        );
      }

      const geminiResponse = await fetch(
        // Key goes in the x-goog-api-key header, never the URL — URLs land in
        // logs, Sentry breadcrumbs, and proxies (§S key-in-URL).
        `https://generativelanguage.googleapis.com/v1beta/models/${routing.model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const result = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        return NextResponse.json({ error: "output_truncated", userMessage: TRUNCATION_MESSAGE }, { status: 200 });
      }
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
    if (!isValidModelId(routing.model)) {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    // --- BYOK providers: one dispatch through the adapter table (G17). Adding a
    // provider is a single record in PROVIDER_ADAPTERS; the six OpenAI-compatible
    // providers share one adapter. (local_llm is rejected at the top — client-side.) ---
    const adapter = PROVIDER_ADAPTERS[provider];
    if (!adapter) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const upstream = await fetch(adapter.url(routing.model, row.endpointUrl), {
      method: "POST",
      headers: adapter.headers(decryptedKey),
      body: JSON.stringify(adapter.body(routing.model, combinedPrompt, 1024)),
    });

    if (!upstream.ok) {
      const rawBody = await upstream.text();
      const mapped = adapter.mapError(upstream.status, rawBody);
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    const parsed = adapter.parse(await upstream.json());
    if (parsed.truncated) {
      return NextResponse.json({ error: "output_truncated", userMessage: TRUNCATION_MESSAGE }, { status: 200 });
    }

    getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, model: routing.model, input_tokens: parsed.inputTokens, output_tokens: parsed.outputTokens } });
    return NextResponse.json({
      result: parsed.text,
      model: routing.model,
      tokensUsed: { inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
