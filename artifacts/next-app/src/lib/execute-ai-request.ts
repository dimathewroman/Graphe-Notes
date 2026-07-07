// Single client-side AI request path (G8, Phase 9.1). Previously the toolbar hook,
// the first-run queue, and the AIPanel each reimplemented the cloud + local-LLM
// fetch, status handling, and result parsing — four copies that drifted. This is
// the one place that makes an AI request and normalizes the outcome; callers keep
// their own orchestration (retry timing, cancel, position-mapping, UI) on top.

import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { drainSseEvents, parseSsePayload } from "@lib/ai-stream";

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

// Map an error/non-2xx /api/ai/generate response to an outcome. Returns null for
// a 2xx status so the caller handles success. Shared by the one-shot and
// streaming paths so both surface RPM-retry / rate-limit info identically.
async function mapCloudErrorStatus(res: Response): Promise<AiRequestOutcome | null> {
  if (res.status === 429) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; resetInMs?: number; retryAfterMs?: number };
    const kind = data.error ?? data.reason;
    if (kind === "rpm_limit") {
      return { ok: false, retryDelayMs: data.retryAfterMs ?? data.resetInMs ?? 60000, message: "AI is busy." };
    }
    if (kind === "hourly_limit_reached") {
      const resetMins = Math.ceil((data.resetInMs ?? 0) / 60000);
      return { ok: false, message: `You've reached your hourly AI limit. Resets in ${resetMins} minutes.`, rateLimit: { reason: "hourly_limit_reached", resetInMs: data.resetInMs } };
    }
    if (kind === "monthly_limit_reached") {
      return { ok: false, message: "Monthly AI limit reached. Add your own API key in Settings for unlimited use.", rateLimit: { reason: "monthly_limit_reached" } };
    }
    return { ok: false, message: "AI is busy. Please try again in a moment." };
  }
  if (res.status === 400) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (data.error === "no_key_configured") return { ok: false, message: "No API key configured. Please add one in Settings." };
    return { ok: false, message: "AI request failed. Please try again." };
  }
  if (res.status === 401) return { ok: false, message: "AI key invalid or missing. Check Settings." };
  if (res.status === 502) return { ok: false, message: "AI request failed. Please try again." };
  if (!res.ok) {
    // Any other non-2xx (e.g. 504 upstream_timeout) — prefer the server's userMessage.
    const data = (await res.json().catch(() => ({}))) as { error?: string; userMessage?: string };
    if (data.error) return { ok: false, message: data.userMessage ?? data.error };
    return { ok: false, message: "AI request failed. Please try again." };
  }
  return null;
}

async function runCloud(opts: AiRequestOptions): Promise<AiRequestOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.demoMock) headers["x-graphe-demo-ai"] = "1";
  const res = await authenticatedFetch("/api/ai/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ provider: opts.provider, taskType: opts.taskType, prompt: opts.prompt, system: opts.system, action: opts.action }),
    signal: opts.signal,
  });

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
  const res = await authenticatedFetch("/api/ai/generate", {
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

  if (!res.ok) {
    // Errors arrive as JSON before any stream starts — map them like the one-shot
    // path so RPM-retry / rate-limit handling is identical.
    const mapped = await mapCloudErrorStatus(res);
    return mapped ?? { ok: false, message: "AI request failed. Please try again." };
  }
  if (!res.body) return { ok: false, message: "AI request failed. Please try again." };

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
    return { ok: false, message: "AI stream failed. Please try again." };
  }
  return { ok: true, text: full };
}
