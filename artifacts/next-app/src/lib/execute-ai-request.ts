// Single client-side AI request path (G8, Phase 9.1). Previously the toolbar hook,
// the first-run queue, and the AIPanel each reimplemented the cloud + local-LLM
// fetch, status handling, and result parsing — four copies that drifted. This is
// the one place that makes an AI request and normalizes the outcome; callers keep
// their own orchestration (retry timing, cancel, position-mapping, UI) on top.

import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { drainSseEvents, parseSsePayload } from "@lib/ai-stream";
import { resolveAiError } from "@lib/ai-errors";

// A per-minute limit that the provider didn't hand us a delay for still gets one
// retry, after this default, so the "retrying…" message isn't a lie.
const RPM_DEFAULT_RETRY_MS = 60_000;

// Turn a thrown fetch (network down, DNS, CORS) into a user-facing outcome —
// offline when the browser knows it's offline, a generic connection error
// otherwise. AbortErrors are re-thrown so callers can treat cancel distinctly.
function networkOutcome(err: unknown): AiRequestOutcome {
  if (err instanceof DOMException && err.name === "AbortError") throw err;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return { ok: false, message: resolveAiError(offline ? "offline" : "upstream_error").message };
}

// G16-partial: shared React Query key for the AI settings (active provider + local
// config). Cached so rapid successive AI actions don't each refetch; SettingsModal
// invalidates it after any provider/key change.
export const AI_SETTINGS_QUERY_KEY = ["/api/ai/settings"] as const;

// Strip <think>...</think> blocks emitted by reasoning models (DeepSeek R1, Qwen3
// thinking variants) before the text reaches the editor.
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trimStart();
}

export interface LocalLlmConfig {
  endpoint: string;
  model: string | null;
  apiKey: string | null;
}

export interface AiRequestOptions {
  provider: string;
  prompt: string;
  taskType: string;
  /** G12 (10.1): task instruction for the provider's system role. The `prompt` is
   *  then the fenced user content. Omitted for freeform (AIPanel) requests. */
  system?: string;
  /** G18: the AI action name (e.g. "improve", "summarize_short") for per-action telemetry. */
  action?: string;
  /** Demo-AI harness: tag the request so the flag-gated mock branch in
   *  /api/ai/generate serves a canned response (no auth, no real provider). */
  demoMock?: boolean;
  /** Required when provider === "local_llm". */
  localLlm?: LocalLlmConfig;
  /** Cancels the request (cloud path). */
  signal?: AbortSignal;
  /** Local LLMs are un-metered, so they get a larger token budget. */
  localMaxTokens?: number;
}

/**
 * The normalized result of one AI request attempt.
 * - `ok` + `text`: success.
 * - `retryDelayMs`: caller should wait this long and try again (RPM-429).
 * - `message`: friendly, user-facing text when `ok` is false.
 * - `rateLimit`: structured limit info for telemetry.
 * AbortErrors propagate (not swallowed) so callers can treat cancel distinctly.
 */
export interface AiRequestOutcome {
  ok: boolean;
  text?: string;
  retryDelayMs?: number;
  message?: string;
  rateLimit?: { reason: string; resetInMs?: number };
}

const DEFAULT_LOCAL_MAX_TOKENS = 4096;

async function runLocal(opts: AiRequestOptions): Promise<AiRequestOutcome> {
  const cfg = opts.localLlm;
  if (!cfg?.endpoint) {
    return { ok: false, message: "Local LLM endpoint not configured. Please check Settings." };
  }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
    // G12: task instruction in a system message, fenced content in the user message.
    const messages = opts.system
      ? [{ role: "system", content: opts.system }, { role: "user", content: opts.prompt }]
      : [{ role: "user", content: opts.prompt }];
    const res = await fetch(`${cfg.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        model: cfg.model ?? "default",
        messages,
        max_tokens: opts.localMaxTokens ?? DEFAULT_LOCAL_MAX_TOKENS,
        stream: false,
      }),
    });
    if (!res.ok) return { ok: false, message: "Local LLM returned an error" };
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return { ok: true, text: stripThinkTags(data.choices[0]?.message?.content ?? "") };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof TypeError) {
      return { ok: false, message: "Could not reach local LLM. Make sure your inference server is running." };
    }
    return { ok: false, message: err instanceof Error ? err.message : "AI request failed" };
  }
}

// Map a non-OK /api/ai/generate response to an outcome. The route now tags every
// failure with a stable code + registry-resolved `userMessage` (see ai-errors.ts),
// so this just trusts that copy and decides retry/telemetry from the code. Returns
// null for a 2xx so the caller handles success (and 200-with-error bodies like
// output_truncated / content_filtered). Shared by the one-shot and streaming paths.
async function mapCloudErrorStatus(res: Response): Promise<AiRequestOutcome | null> {
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    userMessage?: string;
    retryAfterMs?: number | null;
    reason?: string;
    resetInMs?: number;
  };
  const code = data.error;
  const message = data.userMessage ?? "AI request failed. Please try again.";
  // Only a per-minute limit auto-retries; a daily quota / blocked error must not.
  const retryDelayMs = code === "provider_rpm" ? data.retryAfterMs ?? RPM_DEFAULT_RETRY_MS : undefined;
  const rateLimit = data.reason ? { reason: data.reason, resetInMs: data.resetInMs } : undefined;
  return { ok: false, message, retryDelayMs, rateLimit };
}

async function runCloud(opts: AiRequestOptions): Promise<AiRequestOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.demoMock) headers["x-graphe-demo-ai"] = "1";
  let res: Response;
  try {
    res = await authenticatedFetch("/api/ai/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ provider: opts.provider, taskType: opts.taskType, prompt: opts.prompt, system: opts.system, action: opts.action }),
      signal: opts.signal,
    });
  } catch (err) {
    return networkOutcome(err);
  }

  const mapped = await mapCloudErrorStatus(res);
  if (mapped) return mapped;

  const data = (await res.json()) as { error?: string; result?: string; userMessage?: string };
  if (data.error) return { ok: false, message: data.userMessage ?? data.error };
  return { ok: true, text: data.result ?? "" };
}

export function executeAiRequest(opts: AiRequestOptions): Promise<AiRequestOutcome> {
  return opts.provider === "local_llm" ? runLocal(opts) : runCloud(opts);
}

/**
 * Streaming variant (9.3). POSTs with `stream: true`, consumes the SSE response
 * (`data: {"delta":"…"}` frames, then [DONE]), and calls `onDelta` for each text
 * delta as it arrives. Resolves with the full accumulated text. Framing is done
 * by the pure ai-stream primitives so partial frames across network chunk
 * boundaries are handled. AbortErrors propagate so callers can treat cancel
 * distinctly.
 */
export async function executeAiStreamRequest(
  opts: AiRequestOptions,
  onDelta: (delta: string) => void,
): Promise<AiRequestOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.demoMock) headers["x-graphe-demo-ai"] = "1";
  let res: Response;
  try {
    res = await authenticatedFetch("/api/ai/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: opts.provider,
        taskType: opts.taskType,
        prompt: opts.prompt,
        system: opts.system,
        action: opts.action,
        stream: true,
      }),
      signal: opts.signal,
    });
  } catch (err) {
    return networkOutcome(err);
  }

  if (!res.ok) {
    // Errors arrive as JSON before any stream starts — map them like the one-shot
    // path so RPM-retry / rate-limit handling is identical.
    const mapped = await mapCloudErrorStatus(res);
    return mapped ?? { ok: false, message: resolveAiError("upstream_error").message };
  }
  if (!res.body) return { ok: false, message: resolveAiError("upstream_error").message };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { payloads, rest } = drainSseEvents(buffer);
      buffer = rest;
      for (const payload of payloads) {
        const event = parseSsePayload(payload) as { delta?: string } | null;
        if (event?.delta) {
          full += event.delta;
          onDelta(event.delta);
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    // A drop after some text streamed is "interrupted"; before any is a plain fail.
    return { ok: false, message: resolveAiError(full ? "stream_interrupted" : "upstream_error").message };
  }
  // A clean stream that produced nothing (all budget spent thinking, an instant
  // MAX_TOKENS, or a content-filter block) must not fail silently — surface it.
  if (full === "") return { ok: false, message: resolveAiError("stream_empty").message };
  return { ok: true, text: full };
}
