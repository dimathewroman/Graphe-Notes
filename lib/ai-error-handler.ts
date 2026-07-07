import type { AiErrorCode } from "./ai-errors";

// Classify a non-OK response from the Gemini REST API into one of our stable
// error codes (see ai-errors.ts). The interesting case is a 429: Gemini's
// top-level `error.message` is GENERIC ("You exceeded your current quota…") — the
// signal for per-minute vs per-day lives in `error.details`:
//   - QuotaFailure.violations[].quotaId / quotaMetric — e.g.
//     "GenerateRequestsPerDayPerProjectPerModel-FreeTier" (daily) vs
//     "GenerateRequestsPerMinutePerProjectPerModel" (per-minute).
//   - RetryInfo.retryDelay — e.g. "27s", the real backoff.
// The previous version only string-matched the generic message for "per day",
// so a genuine daily exhaustion was mislabeled as a momentary per-minute limit
// and told the user to "retry in a moment" forever. We now read the quota id and
// the RetryInfo instead.

export type ParsedGeminiError = {
  code: AiErrorCode;
  /** Provider-reported backoff (RPM only). Null when absent or terminal. */
  retryAfterMs: number | null;
  raw: string;
};

// Beyond this, a "retry after" is not a per-minute hiccup — treat as a real cap.
const RPM_RETRY_CEILING_MS = 5 * 60 * 1000;

// Parse a google.rpc.Duration string ("27s", "1.5s", "0.500s") to milliseconds.
function parseRetryDelay(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!m) return null;
  const ms = Math.round(parseFloat(m[1]) * 1000);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

type GeminiDetail = {
  "@type"?: string;
  retryDelay?: string;
  violations?: Array<{ quotaId?: string; quotaMetric?: string }>;
};

// Pull RetryInfo delay + the first quota id/metric out of error.details.
function inspectDetails(details: GeminiDetail[]): { retryAfterMs: number | null; quotaKey: string } {
  let retryAfterMs: number | null = null;
  const quotaBits: string[] = [];
  for (const d of details) {
    const type = d["@type"] ?? "";
    if (type.includes("RetryInfo")) {
      retryAfterMs = parseRetryDelay(d.retryDelay);
    }
    if (type.includes("QuotaFailure") && Array.isArray(d.violations)) {
      for (const v of d.violations) {
        if (v.quotaId) quotaBits.push(v.quotaId);
        if (v.quotaMetric) quotaBits.push(v.quotaMetric);
      }
    }
  }
  return { retryAfterMs, quotaKey: quotaBits.join(" ") };
}

// Does a quota id / message name a per-DAY (or per-day-token) limit? Matches the
// Gemini quota-id spellings ("PerDay", "requests_per_day", "…PerDayPer…") plus
// the human phrasings, case-insensitively.
function isDaily(text: string): boolean {
  return /per[_\s-]?day|perday|requests_per_day|tokens_per_day|\bdaily\b|per[_\s-]?day\b|rpd\b/i.test(text);
}
function isPerMinute(text: string): boolean {
  return /per[_\s-]?minute|perminute|requests_per_minute|tokens_per_minute|\brpm\b|\btpm\b/i.test(text);
}

export function parseGeminiError(status: number, rawBody: string): ParsedGeminiError {
  const make = (code: AiErrorCode, retryAfterMs: number | null): ParsedGeminiError => ({ code, retryAfterMs, raw: rawBody });

  let parsed: { error?: { message?: string; status?: string; details?: GeminiDetail[] } } = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    /* non-JSON body — fall through to status-based defaults */
  }
  const message = parsed?.error?.message ?? "";
  const details = Array.isArray(parsed?.error?.details) ? (parsed.error!.details as GeminiDetail[]) : [];

  if (status === 429) {
    const { retryAfterMs, quotaKey } = inspectDetails(details);
    // The quota id is authoritative; the generic message is the weak fallback.
    const haystack = `${quotaKey} ${message}`;

    if (isDaily(haystack)) return make("provider_daily_quota", null);
    if (isPerMinute(haystack)) return make("provider_rpm", retryAfterMs);

    // Unclassified 429: a short provider-supplied backoff means a transient
    // per-minute-style limit; a long or absent one means a real cap we can't
    // name — surface it honestly as a quota block, never a fake retry.
    if (retryAfterMs != null && retryAfterMs <= RPM_RETRY_CEILING_MS) {
      return make("provider_rpm", retryAfterMs);
    }
    return make("provider_quota_unknown", null);
  }

  if (status === 400 && rawBody.includes("API_KEY_INVALID")) return make("invalid_key", null);

  if (status === 404 || rawBody.includes("model is not supported") || rawBody.includes("not found")) {
    return make("model_unavailable", null);
  }

  return make("upstream_error", null);
}
