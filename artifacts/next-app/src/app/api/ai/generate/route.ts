import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { checkAndIncrementUsage, recordTokenUsage } from "@lib/ai-rate-limit";
import { resolveModel, type TaskType, type Provider, GEMINI_FLASH_LITE } from "@lib/ai-model-router";
import { resolveFreeTierModel, invalidateFreeTierModel } from "@lib/gemini-model-discovery";
import { parseGeminiError } from "@lib/ai-error-handler";
import { type AiErrorCode, type AiErrorContext, resolveAiError, httpForCode } from "@lib/ai-errors";
import { generationSettingsFor } from "@/lib/ai-prompts";
import { isDemoAiEnabled, DEMO_AI_HEADER, mockGenerateBody, mockStreamDeltas } from "@/lib/ai-demo-mock";
import { streamProviderDeltas } from "@lib/ai-stream";
import { PROVIDER_ADAPTERS, geminiAdapter, geminiGenerationConfig } from "@lib/ai-providers";
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

// Build an error response from a stable code: the registry supplies the copy +
// severity, httpForCode the status, so the message the user reads and the way the
// client behaves can't drift apart. `extra` carries rate-limit telemetry fields.
function aiError(code: AiErrorCode, ctx: AiErrorContext = {}, extra: Record<string, unknown> = {}) {
  const e = resolveAiError(code, ctx);
  return NextResponse.json(
    { error: e.code, userMessage: e.message, severity: e.severity, retryAfterMs: e.retryAfterMs, ...extra },
    { status: httpForCode(code) },
  );
}

// G16 (9.3): cap how long we wait on an upstream provider. Without this a hung
// provider holds the serverless function open until the platform's own (much
// longer) timeout, burning execution time and leaving the user with a spinner.
const UPSTREAM_TIMEOUT_MS = 30_000;

// Output-token budget for a single AI action. Was 1024, which truncated even a
// ~200-word note once Gemini's thinking tokens (now disabled — see
// geminiThinkingBudget) or a large expand/rewrite are in play. 4096 covers a
// note-sized selection and its transform with headroom, while staying bounded
// for the rate-limited free tier.
const AI_MAX_OUTPUT_TOKENS = 4096;

// Wrap a stream of text deltas in our client SSE contract: `data: {"delta":"…"}`
// frames, then a terminating [DONE]. A mid-stream provider error just ends the
// stream (the client keeps whatever streamed so far).
function sseResponse(deltas: AsyncGenerator<string>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of deltas) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
      } catch (err) {
        Sentry.captureException(err);
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
  });
}

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
      // No valid session — almost always an expired token mid-use. The client
      // shows "session timed out, refresh" rather than a bad-key wild-goose chase.
      return aiError("session_expired");
    }
    const userId = user.id;

    // --- Request validation ---
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return aiError("bad_request");
    }

    if (!body || typeof body !== "object") {
      return aiError("bad_request");
    }

    const { taskType, prompt, context, provider: rawProvider, modelOverride: rawModelOverride, action: rawAction, system: rawSystem, stream: rawStream } =
      body as Record<string, unknown>;
    // 9.3: when true, respond with an SSE token stream instead of one-shot JSON.
    const wantStream = rawStream === true;
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

    // local_llm never routes through the server (it's called client-side); a
    // request for it here is a malformed client, not a user-fixable condition.
    if (provider === "local_llm") return aiError("bad_request");

    if (!taskType || !VALID_TASK_TYPES.includes(taskType as TaskType)) return aiError("bad_request");

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") return aiError("bad_request");

    if (context !== undefined && typeof context !== "string") return aiError("bad_request");

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
        const code = rateLimit.reason === "monthly_limit_reached" ? "free_capacity" : "free_hourly_limit";
        // Keep reason + resetInMs in the body for the client's rate-limit telemetry.
        return aiError(code, { provider, resetInMs: rateLimit.resetInMs }, { reason: rateLimit.reason, resetInMs: rateLimit.resetInMs });
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

      // 9.3: streamed free-tier response (rate limit already counted above).
      if (wantStream) {
        const upstream = await fetch(geminiAdapter.streamUrl(freeModel), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(geminiAdapter.streamBody(freeModel, combinedPrompt, AI_MAX_OUTPUT_TOKENS, system, gen)),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        if (!upstream.ok || !upstream.body) {
          const rawErr = await upstream.text().catch(() => "");
          const { code, retryAfterMs } = parseGeminiError(upstream.status, rawErr);
          return aiError(code, { provider, model: freeModel, retryAfterMs });
        }
        getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, action, model: freeModel, streamed: true } });
        return sseResponse(streamProviderDeltas(upstream.body, geminiAdapter.streamDelta));
      }

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
              generationConfig: geminiGenerationConfig(model, AI_MAX_OUTPUT_TOKENS, gen),
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
        const { code, retryAfterMs } = parseGeminiError(geminiResponse.status, rawErrorBody);
        return aiError(code, { provider, model: freeModel, retryAfterMs });
      }

      // Parse through the adapter so truncation, content-filter, and empty-result
      // handling is identical to the BYOK path below.
      const parsed = geminiAdapter.parse(await geminiResponse.json());
      if (parsed.filtered) return aiError("content_filtered", { provider });
      if (parsed.truncated) return aiError("output_truncated", { provider });
      if (!parsed.text.trim()) return aiError("stream_empty", { provider });

      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, action, model: freeModel, input_tokens: parsed.inputTokens, output_tokens: parsed.outputTokens } });
      // G19: best-effort token accounting — never fail the response on a write error.
      await recordTokenUsage(userId, (parsed.inputTokens ?? 0) + (parsed.outputTokens ?? 0)).catch((e) => Sentry.captureException(e));
      return NextResponse.json({
        result: parsed.text,
        model: freeModel,
        tokensUsed: { inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens },
      });
    }

    // --- Non-free provider path (no rate limiting) ---
    const rows = await db
      .select()
      .from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.provider, provider)));

    const row = rows[0];
    if (!row) return aiError("no_key_configured", { provider });

    const decryptedKey = decryptApiKey(row.encryptedKey);

    // Effective model override: request body → db row fallback
    const effectiveModelOverride = modelOverride ?? (row.modelOverride ?? undefined);

    let routing;
    try {
      routing = resolveModel(provider, taskType as TaskType, effectiveModelOverride);
    } catch {
      return aiError("no_model_configured", { provider });
    }
    if (!isValidModelId(routing.model)) return aiError("model_unavailable", { provider, model: routing.model });

    // --- BYOK providers: one dispatch through the adapter table (G17). Adding a
    // provider is a single record in PROVIDER_ADAPTERS; the six OpenAI-compatible
    // providers share one adapter. (local_llm is rejected at the top — client-side.) ---
    const adapter = PROVIDER_ADAPTERS[provider];
    if (!adapter) return aiError("bad_request");

    // 9.3: streamed BYOK response — same adapter table, streaming url/body.
    if (wantStream) {
      const upstreamStream = await fetch(adapter.streamUrl(routing.model, row.endpointUrl), {
        method: "POST",
        headers: adapter.headers(decryptedKey),
        body: JSON.stringify(adapter.streamBody(routing.model, combinedPrompt, AI_MAX_OUTPUT_TOKENS, system, gen)),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstreamStream.ok || !upstreamStream.body) {
        const rawBody = await upstreamStream.text().catch(() => "");
        const mapped = adapter.mapError(upstreamStream.status, rawBody);
        return aiError(mapped.code, { provider, model: routing.model, retryAfterMs: mapped.retryAfterMs });
      }
      getPostHogClient().capture({ distinctId: userId, event: "ai_generate_completed", properties: { provider, action, model: routing.model, streamed: true } });
      return sseResponse(streamProviderDeltas(upstreamStream.body, adapter.streamDelta));
    }

    const upstream = await fetch(adapter.url(routing.model, row.endpointUrl), {
      method: "POST",
      headers: adapter.headers(decryptedKey),
      body: JSON.stringify(adapter.body(routing.model, combinedPrompt, AI_MAX_OUTPUT_TOKENS, system, gen)),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      const rawBody = await upstream.text();
      const mapped = adapter.mapError(upstream.status, rawBody);
      return aiError(mapped.code, { provider, model: routing.model, retryAfterMs: mapped.retryAfterMs });
    }

    const parsed = adapter.parse(await upstream.json());
    if (parsed.filtered) return aiError("content_filtered", { provider });
    if (parsed.truncated) return aiError("output_truncated", { provider });
    if (!parsed.text.trim()) return aiError("stream_empty", { provider });

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
      return aiError("upstream_timeout");
    }
    Sentry.captureException(err);
    return aiError("internal_error");
  }
}
