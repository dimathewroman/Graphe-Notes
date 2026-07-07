// The shared error registry: one code → severity + truthful, actionable copy.
// Pins the properties the UI depends on — provider/model interpolation, the
// retry-only-when-retryable rule, HTTP mapping, and friendly provider names.
import { describe, it, expect } from "vitest";
import { resolveAiError, providerLabel, httpForCode, isAiErrorCode } from "@lib/ai-errors";

describe("resolveAiError", () => {
  it("interpolates provider + model into the daily-quota message and stays terminal", () => {
    const e = resolveAiError("provider_daily_quota", { provider: "google_ai_studio", model: "gemini-2.5-flash", retryAfterMs: 1500 });
    expect(e.severity).toBe("blocked");
    expect(e.message).toContain("Gemini");
    expect(e.message).toContain("gemini-2.5-flash");
    expect(e.message).toMatch(/midnight Pacific/i);
    expect(e.action).toBe("settings");
    // A blocked error must NOT carry a retry delay, even if one is passed in.
    expect(e.retryAfterMs).toBeNull();
  });

  it("returns the retry delay only for a retryable (transient) code", () => {
    expect(resolveAiError("provider_rpm", { provider: "google_ai_studio", retryAfterMs: 1500 }).retryAfterMs).toBe(1500);
    expect(resolveAiError("provider_rpm", {}).retryAfterMs).toBeNull();
  });

  it("computes the reset-in-minutes for the hourly free limit", () => {
    expect(resolveAiError("free_hourly_limit", { resetInMs: 600_000 }).message).toContain("10 min");
  });

  it("session_expired points to a refresh, not Settings", () => {
    const e = resolveAiError("session_expired");
    expect(e.severity).toBe("setup");
    expect(e.action).toBe("refresh");
    expect(e.message).toMatch(/refresh/i);
  });

  it("no_key_configured names the specific provider", () => {
    expect(resolveAiError("no_key_configured", { provider: "anthropic" }).message).toContain("Claude");
  });

  it("info-severity outcomes (empty selection, no action items) aren't styled as errors", () => {
    expect(resolveAiError("empty_selection").severity).toBe("info");
    expect(resolveAiError("no_action_items").severity).toBe("info");
  });
});

describe("providerLabel", () => {
  it("maps internal ids to friendly names, with a safe fallback", () => {
    expect(providerLabel("google_ai_studio")).toBe("Gemini");
    expect(providerLabel("openai")).toBe("OpenAI");
    expect(providerLabel("graphe_free")).toBe("Graphe AI");
    expect(providerLabel("something_new")).toBe("The AI provider");
    expect(providerLabel(undefined)).toBe("The AI provider");
  });
});

describe("httpForCode", () => {
  it("maps codes to the status the route returns", () => {
    expect(httpForCode("session_expired")).toBe(401);
    expect(httpForCode("invalid_key")).toBe(401);
    expect(httpForCode("provider_daily_quota")).toBe(429);
    expect(httpForCode("upstream_timeout")).toBe(504);
    expect(httpForCode("upstream_error")).toBe(502);
    // A declined/cut-off result rides a 200 — the request itself succeeded.
    expect(httpForCode("content_filtered")).toBe(200);
    expect(httpForCode("output_truncated")).toBe(200);
    expect(httpForCode("internal_error")).toBe(500);
  });
});

describe("isAiErrorCode", () => {
  it("recognizes known codes and rejects everything else", () => {
    expect(isAiErrorCode("provider_rpm")).toBe(true);
    expect(isAiErrorCode("nope")).toBe(false);
    expect(isAiErrorCode(undefined)).toBe(false);
    expect(isAiErrorCode(42)).toBe(false);
  });
});
