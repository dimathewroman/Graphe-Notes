import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkAndIncrementUsage, recordTokenUsage } from "@lib/ai-rate-limit";
import { resolveModel, type TaskType, type Provider, GEMINI_FLASH_LITE } from "@lib/ai-model-router";
import { resolveFreeTierModel, invalidateFreeTierModel } from "@lib/gemini-model-discovery";
import { parseGeminiError } from "@lib/ai-error-handler";
import { generationSettingsFor } from "@/lib/ai-prompts";
import { isDemoAiEnabled, DEMO_AI_HEADER, mockGenerateBody, mockStreamDeltas } from "@/lib/ai-demo-mock";
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

// G16 (9.3): cap how long we wait on an upstream provider. Without this a hung
// provider holds the serverless function open until the platform's own (much
// longer) timeout, burning execution time and leaving the user with a spinner.
const UPSTREAM_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  try {
    // --- Demo-AI harness (dev/CI only) ---
    // When NEXT_PUBLIC_ENABLE_DEMO_AI is set AND the request carries the demo
    // header, serve a deterministic canned response with no auth and no real
    // provider. The flag is unset in production, so this branch is dead there;
    // even if the header were forged, the env gate short-circuits first.
    if (isDemoAiEnabled() && request.headers.get(DEMO_AI_HEADER) === "1") {
      const body = (await request.json().catch(() => ({}))) as { action?: unknown; stream?: unknown };
      const action = typeof body.action === "string" ? body.action : undefined;
      if (body.stream === true) {
        // Emit the canned deltas as SSE, paced so the stream is observably
        // progressive. Client contract: `data: {"delta":"…"}` frames, then [DONE].
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            for (const delta of mockStreamDeltas(action)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              await new Promise((r) => setTimeout(r, 40));
            }
            controller.enqueue(encoder.encode('data: {"done":true,"model":"mock"}\n\n'));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
        });
      }
      return NextResponse.json(mockGenerateBody(action));
    }

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

    const { taskType, prompt, context, provider: rawProvider, modelOverride: rawModelOverride, action: rawAction, system: rawSystem } =
      body as Record<string, unknown>;
    // G18: the AI action name for per-action telemetry (optional; sanitized to a string).
    const action = typeof rawAction === "string" ? rawAction : undefined;
    // G12 (10.1): task instruction for the provider's system role (optional).
    const system = typeof rawSystem === "string" ? rawSystem : undefined;
    // G14 (10.3): per-action sampling — mechanical actions near-deterministic,
    // creative ones varied. Derived server-side from the action name.
    const gen = generationSettingsFor(action ?? "");

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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY environment variable is required but not set.",
        );
      }

      // G19: self-healing free-tier model. Discover the lightest available model
      // (cached, best-effort) instead of a hardcoded id; fall back to the constant
      // if discovery returns something unexpected.
      let freeModel = await resolveFreeTierModel(apiKey);
      if (!isValidModelId(freeModel)) freeModel = GEMINI_FLASH_LITE;

      const callGemini = (model: string) =>
        fetch(
          // Key goes in the x-goog-api-key header, never the URL — URLs land in
          // logs, Sentry breadcrumbs, and proxies (§S key-in-URL).
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: combinedPrompt }] }],
              ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
              generationConfig: { maxOutputTokens: 1024, temperature: gen.temperature, topP: gen.topP },
            }),
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          },
        );

      let geminiResponse = await callGemini(freeModel);
      // A 404 means the cached/hardcoded model id was retired upstream. Drop the
      // cache, re-discover, and retry once before surfacing an error.
      if (geminiResponse.status === 404) {
        invalidateFreeTierModel();
        const rediscovered = await resolveFreeTierModel(apiKey);
        if (rediscovered !== freeModel && isValidModelId(rediscovered)) {
          freeModel = rediscovered;
          geminiResponse = await callGemini(freeModel);
        }
      }

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

      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, action, model: freeModel, input_tokens: inputTokens, output_tokens: outputTokens } });
      // G19: best-effort token accounting — never fail the response on a write error.
      await recordTokenUsage(userId, (inputTokens ?? 0) + (outputTokens ?? 0)).catch((e) => Sentry.captureException(e));
      return NextResponse.json({
        result,
        model: freeModel,
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
      body: JSON.stringify(adapter.body(routing.model, combinedPrompt, 1024, system, gen)),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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

    getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, action, model: routing.model, input_tokens: parsed.inputTokens, output_tokens: parsed.outputTokens } });
    // G19: best-effort token accounting (BYOK too, via upsert).
    await recordTokenUsage(userId, (parsed.inputTokens ?? 0) + (parsed.outputTokens ?? 0)).catch((e) => Sentry.captureException(e));
    return NextResponse.json({
      result: parsed.text,
      model: routing.model,
      tokensUsed: { inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens },
    });
  } catch (err) {
    // G16 (9.3): a hit UPSTREAM_TIMEOUT_MS surfaces as a TimeoutError from
    // AbortSignal.timeout. Return a clean 504 instead of a generic 500 so the
    // client can show "try again" rather than "something broke".
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "upstream_timeout", userMessage: "The AI provider took too long to respond. Please try again." },
        { status: 504 },
      );
    }
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
