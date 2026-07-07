// The quota classifier is the linchpin of the error suite. Gemini's 429 body has
// a GENERIC top-level message ("You exceeded your current quota…"); the signal for
// per-minute vs per-day lives in error.details[].violations[].quotaId + RetryInfo.
// These tests pin that we read the quota id (not the prose) so a daily exhaustion
// is never again mislabeled as a momentary per-minute limit.
import { describe, it, expect } from "vitest";
import { parseGeminiError } from "@lib/ai-error-handler";

// A realistic Gemini RESOURCE_EXHAUSTED body: generic message, quota id in
// details, plus a RetryInfo. `quotaId` decides day-vs-minute.
function quota429(quotaId: string, retryDelay?: string): string {
  return JSON.stringify({
    error: {
      code: 429,
      message: "You exceeded your current quota, please check your plan and billing details.",
      status: "RESOURCE_EXHAUSTED",
      details: [
        {
          "@type": "type.googleapis.com/google.rpc.QuotaFailure",
          violations: [{ quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests", quotaId }],
        },
        ...(retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : []),
      ],
    },
  });
}

describe("parseGeminiError — quota classification (the daily-vs-minute bug)", () => {
  it("classifies a per-DAY quota id as a terminal daily limit (no retry)", () => {
    const e = parseGeminiError(429, quota429("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "34s"));
    expect(e.code).toBe("provider_daily_quota");
    expect(e.retryAfterMs).toBeNull(); // daily → never a "retry in a moment"
  });

  it("classifies a per-MINUTE quota id as a transient rpm limit with the real backoff", () => {
    const e = parseGeminiError(429, quota429("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "27s"));
    expect(e.code).toBe("provider_rpm");
    expect(e.retryAfterMs).toBe(27000); // read from RetryInfo, not hardcoded
  });

  it("parses fractional RetryInfo durations", () => {
    const e = parseGeminiError(429, quota429("…PerMinute…", "1.5s"));
    expect(e.retryAfterMs).toBe(1500);
  });

  it("a token-per-day quota id also reads as daily", () => {
    const e = parseGeminiError(429, quota429("GenerateContentInputTokensPerModelPerDay-FreeTier"));
    expect(e.code).toBe("provider_daily_quota");
  });

  it("falls back to the message text when there's no quota id", () => {
    const perDay = JSON.stringify({ error: { message: "Quota exceeded: requests per day limit." } });
    expect(parseGeminiError(429, perDay).code).toBe("provider_daily_quota");
    const perMin = JSON.stringify({ error: { message: "Rate limit: requests per minute exceeded." } });
    expect(parseGeminiError(429, perMin).code).toBe("provider_rpm");
  });

  it("treats an unclassifiable 429 with a SHORT backoff as a transient rpm limit", () => {
    const body = JSON.stringify({ error: { message: "quota", details: [{ "@type": "…RetryInfo", retryDelay: "20s" }] } });
    const e = parseGeminiError(429, body);
    expect(e.code).toBe("provider_rpm");
    expect(e.retryAfterMs).toBe(20000);
  });

  it("treats an unclassifiable 429 with a LONG (or no) backoff as a quota block, not a fake retry", () => {
    const longDelay = JSON.stringify({ error: { message: "quota", details: [{ "@type": "…RetryInfo", retryDelay: "3600s" }] } });
    expect(parseGeminiError(429, longDelay).code).toBe("provider_quota_unknown");
    const noDelay = JSON.stringify({ error: { message: "quota exceeded" } });
    expect(parseGeminiError(429, noDelay).code).toBe("provider_quota_unknown");
  });

  it("handles a non-JSON 429 body without throwing", () => {
    const e = parseGeminiError(429, "<html>429 Too Many Requests</html>");
    expect(e.code).toBe("provider_quota_unknown");
    expect(e.retryAfterMs).toBeNull();
  });
});

describe("parseGeminiError — non-429 statuses", () => {
  it("400 with API_KEY_INVALID → invalid_key", () => {
    expect(parseGeminiError(400, JSON.stringify({ error: { status: "INVALID_ARGUMENT", message: "API_KEY_INVALID" } })).code).toBe("invalid_key");
  });
  it("404 → model_unavailable", () => {
    expect(parseGeminiError(404, JSON.stringify({ error: { message: "model is not supported" } })).code).toBe("model_unavailable");
  });
  it("any other status → upstream_error", () => {
    expect(parseGeminiError(500, "boom").code).toBe("upstream_error");
    expect(parseGeminiError(503, "").code).toBe("upstream_error");
  });
});
