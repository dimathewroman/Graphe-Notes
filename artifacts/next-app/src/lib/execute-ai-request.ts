// Single client-side AI request path (G8, Phase 9.1). Previously the toolbar hook,
// the first-run queue, and the AIPanel each reimplemented the cloud + local-LLM
// fetch, status handling, and result parsing — four copies that drifted. This is
// the one place that makes an AI request and normalizes the outcome; callers keep
// their own orchestration (retry timing, cancel, position-mapping, UI) on top.

import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";

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
    const res = await fetch(`${cfg.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers,
      signal: opts.signal,
      body: JSON.stringify({
        model: cfg.model ?? "default",
        messages: [{ role: "user", content: opts.prompt }],
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

async function runCloud(opts: AiRequestOptions): Promise<AiRequestOutcome> {
  const res = await authenticatedFetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: opts.provider, taskType: opts.taskType, prompt: opts.prompt }),
    signal: opts.signal,
  });

  if (res.status === 429) {
    const data = (await res.json()) as { error?: string; reason?: string; resetInMs?: number; retryAfterMs?: number };
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
    const data = (await res.json()) as { error?: string };
    if (data.error === "no_key_configured") return { ok: false, message: "No API key configured. Please add one in Settings." };
    return { ok: false, message: "AI request failed. Please try again." };
  }
  if (res.status === 401) return { ok: false, message: "AI key invalid or missing. Check Settings." };
  if (res.status === 502) return { ok: false, message: "AI request failed. Please try again." };

  const data = (await res.json()) as { error?: string; result?: string; userMessage?: string };
  if (data.error) return { ok: false, message: data.userMessage ?? data.error };
  return { ok: true, text: data.result ?? "" };
}

export function executeAiRequest(opts: AiRequestOptions): Promise<AiRequestOutcome> {
  return opts.provider === "local_llm" ? runLocal(opts) : runCloud(opts);
}
