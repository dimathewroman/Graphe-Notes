// Single registry for every way an AI action can fail (the error-handling suite).
// One code → one severity + one truthful, actionable message. Shared by the
// server (route + adapters tag failures with a code) and the client (renders the
// message from the code), so what the user sees and how the app behaves can't
// drift apart. Pure + dependency-free so both @lib server code and next-app can
// import it.

export type AiErrorSeverity =
  | "transient" // passes on its own — safe to auto-retry / "try again"
  | "blocked" // a quota/limit that won't clear soon — state when + offer an alternative
  | "setup" // needs a user action in Settings (or a page refresh)
  | "fatal" // unexpected — logged to Sentry, calm generic line
  | "info"; // a normal outcome shown as status, never an "error"

export type AiErrorAction = "settings" | "refresh" | "retry" | null;

export type AiErrorCode =
  // session & access
  | "session_expired"
  | "not_signed_in"
  // setup & keys
  | "no_key_configured"
  | "no_model_configured"
  | "local_llm_unconfigured"
  | "invalid_key"
  // limits & quotas
  | "free_hourly_limit"
  | "free_capacity"
  | "provider_rpm"
  | "provider_daily_quota"
  | "provider_quota_unknown"
  // provider & upstream
  | "model_unavailable"
  | "upstream_timeout"
  | "upstream_error"
  | "content_filtered"
  // result & streaming
  | "output_truncated"
  | "stream_empty"
  | "stream_interrupted"
  | "no_action_items"
  // connection & client
  | "offline"
  | "local_llm_unreachable"
  | "empty_selection"
  | "bad_request"
  | "internal_error";

export interface AiErrorContext {
  provider?: string;
  model?: string | null;
  /** Time until a per-user window resets (free hourly limit). */
  resetInMs?: number | null;
  /** Provider-reported retry delay (RPM). Drives the countdown + auto-retry. */
  retryAfterMs?: number | null;
  /** Upstream HTTP status, for the generic upstream_error line. */
  upstreamStatus?: number | null;
  /** Local LLM endpoint, for the unreachable message. */
  endpoint?: string | null;
}

export interface ResolvedAiError {
  code: AiErrorCode;
  severity: AiErrorSeverity;
  title: string;
  message: string;
  /** Non-null only for transient limits (RPM): the client waits this long, once. */
  retryAfterMs: number | null;
  action: AiErrorAction;
}

// Friendly provider names. The internal ids (google_ai_studio) never reach a user.
const PROVIDER_LABELS: Record<string, string> = {
  graphe_free: "Graphe AI",
  google_ai_studio: "Gemini",
  openai: "OpenAI",
  anthropic: "Claude",
  openrouter: "OpenRouter",
  groq: "Groq",
  mistral: "Mistral",
  together: "Together",
  fireworks: "Fireworks",
  custom_openai: "your AI provider",
  local_llm: "your local AI",
};

export function providerLabel(provider?: string): string {
  return (provider && PROVIDER_LABELS[provider]) || "The AI provider";
}

interface RegistryEntry {
  severity: AiErrorSeverity;
  title: string;
  action: AiErrorAction;
  /** True for errors the client may auto-retry after retryAfterMs. */
  retryable: boolean;
  message: (ctx: AiErrorContext) => string;
}

const mins = (ms?: number | null) => Math.max(1, Math.ceil((ms ?? 0) / 60000));

const REGISTRY: Record<AiErrorCode, RegistryEntry> = {
  // ── session & access ──
  session_expired: {
    severity: "setup", action: "refresh", retryable: false,
    title: "Session timed out",
    message: () => "Your session timed out. Refresh the page to sign back in, then try again.",
  },
  not_signed_in: {
    severity: "setup", action: null, retryable: false,
    title: "Sign up to use AI",
    message: () => "Sign up to use AI features.",
  },

  // ── setup & keys ──
  no_key_configured: {
    severity: "setup", action: "settings", retryable: false,
    title: "No API key",
    message: (c) => `Add your ${providerLabel(c.provider)} API key in Settings → AI to use this.`,
  },
  no_model_configured: {
    severity: "setup", action: "settings", retryable: false,
    title: "No model chosen",
    message: (c) => `Choose a model for ${providerLabel(c.provider)} in Settings → AI.`,
  },
  local_llm_unconfigured: {
    severity: "setup", action: "settings", retryable: false,
    title: "Local AI not set up",
    message: () => "Your local AI endpoint isn't set. Add it in Settings → AI.",
  },
  invalid_key: {
    severity: "setup", action: "settings", retryable: false,
    title: "API key rejected",
    message: (c) => `${providerLabel(c.provider)} rejected your API key. Check it in Settings → AI.`,
  },

  // ── limits & quotas ──
  free_hourly_limit: {
    severity: "blocked", action: "settings", retryable: false,
    title: "Hourly free limit reached",
    message: (c) =>
      `You've used your 5 free AI requests this hour. More in ${mins(c.resetInMs)} min, or add your own API key in Settings for no limit.`,
  },
  free_capacity: {
    severity: "blocked", action: "settings", retryable: false,
    title: "Free AI at capacity",
    message: () => "Free AI is at capacity this month. Add your own API key in Settings for unlimited use.",
  },
  provider_rpm: {
    severity: "transient", action: "retry", retryable: true,
    title: "Rate-limited",
    message: (c) => `${providerLabel(c.provider)} is busy right now. Retrying in a moment…`,
  },
  provider_daily_quota: {
    severity: "blocked", action: "settings", retryable: false,
    title: "Daily limit reached",
    message: (c) =>
      `You've hit ${providerLabel(c.provider)}'s daily limit${c.model ? ` for ${c.model}` : ""}. ` +
      `It resets around midnight Pacific. Switch to a lighter model in Settings → AI to keep going.`,
  },
  provider_quota_unknown: {
    severity: "blocked", action: "settings", retryable: false,
    title: "Quota reached",
    message: (c) =>
      `${providerLabel(c.provider)} declined the request — quota reached. Try a different model, or add another key in Settings.`,
  },

  // ── provider & upstream ──
  model_unavailable: {
    severity: "setup", action: "settings", retryable: false,
    title: "Model unavailable",
    message: (c) => `${c.model ? `The model “${c.model}”` : "That model"} isn't available. Pick another in Settings → AI.`,
  },
  upstream_timeout: {
    severity: "transient", action: "retry", retryable: true,
    title: "Provider timed out",
    message: (c) => `${providerLabel(c.provider)} took too long to respond. Try again.`,
  },
  upstream_error: {
    severity: "transient", action: "retry", retryable: true,
    title: "Provider error",
    message: (c) =>
      `${providerLabel(c.provider)} returned an error${c.upstreamStatus ? ` (${c.upstreamStatus})` : ""}. Try again in a moment.`,
  },
  content_filtered: {
    severity: "blocked", action: null, retryable: false,
    title: "Request declined",
    message: () => "The AI declined this request as it may violate its content policy. Try rephrasing your selection.",
  },

  // ── result & streaming ──
  output_truncated: {
    severity: "transient", action: "retry", retryable: false,
    title: "Response cut off",
    message: () => "The response was cut off. Try selecting less text, or ask for a shorter result.",
  },
  stream_empty: {
    severity: "transient", action: "retry", retryable: false,
    title: "Empty response",
    message: () => "The AI returned nothing. Try again, or shorten the selection.",
  },
  stream_interrupted: {
    severity: "transient", action: "retry", retryable: false,
    title: "Response interrupted",
    message: () => "The response was interrupted. Try again for the rest.",
  },
  no_action_items: {
    severity: "info", action: null, retryable: false,
    title: "Nothing to extract",
    message: () => "No action items found.",
  },

  // ── connection & client ──
  offline: {
    severity: "transient", action: "retry", retryable: false,
    title: "You're offline",
    message: () => "You're offline. AI needs a connection — reconnect and try again.",
  },
  local_llm_unreachable: {
    severity: "setup", action: "settings", retryable: false,
    title: "Local AI unreachable",
    message: (c) => `Couldn't reach your local AI server${c.endpoint ? ` at ${c.endpoint}` : ""}. Is it running?`,
  },
  empty_selection: {
    severity: "info", action: null, retryable: false,
    title: "Nothing selected",
    message: () => "Select some text first, then choose an AI action.",
  },
  bad_request: {
    severity: "fatal", action: null, retryable: false,
    title: "Request problem",
    message: () => "Something went wrong preparing that request. Please try again.",
  },
  internal_error: {
    severity: "fatal", action: null, retryable: false,
    title: "Something broke",
    message: () => "Something broke on our end. It's been logged — try again shortly.",
  },
};

const KNOWN_CODES = new Set(Object.keys(REGISTRY) as AiErrorCode[]);

export function isAiErrorCode(v: unknown): v is AiErrorCode {
  return typeof v === "string" && KNOWN_CODES.has(v as AiErrorCode);
}

// HTTP status the /api/ai/generate route returns for a given code, so the server
// and the client's status handling agree. content_filtered / output_truncated
// ride a 200 — the request succeeded, the model just declined or was cut off, and
// the client reads the code from the body.
const HTTP_FOR_CODE: Partial<Record<AiErrorCode, number>> = {
  session_expired: 401,
  invalid_key: 401,
  no_key_configured: 400,
  no_model_configured: 400,
  local_llm_unconfigured: 400,
  model_unavailable: 400,
  bad_request: 400,
  free_hourly_limit: 429,
  free_capacity: 429,
  provider_rpm: 429,
  provider_daily_quota: 429,
  provider_quota_unknown: 429,
  upstream_timeout: 504,
  upstream_error: 502,
  content_filtered: 200,
  output_truncated: 200,
  internal_error: 500,
};

export function httpForCode(code: AiErrorCode): number {
  return HTTP_FOR_CODE[code] ?? 500;
}

/**
 * Resolve a code + context into the concrete error the UI shows. `retryAfterMs`
 * is returned only for a retryable code that was given a delay — so a "blocked"
 * daily quota never gets a bogus "retry in a moment" countdown.
 */
export function resolveAiError(code: AiErrorCode, ctx: AiErrorContext = {}): ResolvedAiError {
  const entry = REGISTRY[code] ?? REGISTRY.internal_error;
  return {
    code,
    severity: entry.severity,
    title: entry.title,
    message: entry.message(ctx),
    retryAfterMs: entry.retryable ? ctx.retryAfterMs ?? null : null,
    action: entry.action,
  };
}
