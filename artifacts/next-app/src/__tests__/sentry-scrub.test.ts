// Phase 2.3: secret query params must never ride into Sentry breadcrumbs.
import { describe, it, expect } from "vitest";
import { scrubSecretsFromBreadcrumb } from "@/lib/sentry-scrub";

describe("scrubSecretsFromBreadcrumb", () => {
  it("redacts a Gemini ?key= param in a breadcrumb URL", () => {
    const b = scrubSecretsFromBreadcrumb({
      category: "fetch",
      data: { url: "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=AIzaSECRET" },
    });
    expect(b.data!.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=[REDACTED]",
    );
  });

  it("redacts token/api_key mid-query without dropping other params", () => {
    const b = scrubSecretsFromBreadcrumb({
      data: { url: "https://api.example.com/x?foo=1&token=abc123&bar=2" },
    });
    expect(b.data!.url).toBe("https://api.example.com/x?foo=1&token=[REDACTED]&bar=2");
  });

  it("leaves breadcrumbs without a url untouched", () => {
    const b = scrubSecretsFromBreadcrumb({ message: "hello" });
    expect(b).toEqual({ message: "hello" });
  });
});
