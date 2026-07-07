// Regression for the production "Something broke on our end" 500: the free-tier
// path threw a raw Error when GEMINI_API_KEY was missing in the environment —
// which (a) burned one of the user's 5 hourly requests because the usage counter
// had already incremented, and (b) surfaced a scary generic 500. The key check
// now runs BEFORE the increment and returns a clean free_unavailable.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({ getAuthUser: (...a: unknown[]) => getAuthUser(...a) }));

const checkAndIncrementUsage = vi.fn();
vi.mock("@lib/ai-rate-limit", () => ({
  checkAndIncrementUsage: (...a: unknown[]) => checkAndIncrementUsage(...a),
  recordTokenUsage: vi.fn(),
}));

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

vi.mock("@/lib/posthog-server", () => ({ getPostHogClient: () => ({ capture: vi.fn() }) }));
vi.mock("@workspace/db", () => ({ db: {}, userApiKeysTable: {} }));
vi.mock("@lib/encryption", () => ({ decryptApiKey: vi.fn() }));
vi.mock("@lib/gemini-model-discovery", () => ({
  resolveFreeTierModel: vi.fn().mockResolvedValue("gemini-2.5-flash-lite"),
  invalidateFreeTierModel: vi.fn(),
}));

import { POST } from "@/app/api/ai/generate/route";

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  getAuthUser.mockResolvedValue({ user: { id: "user-1" } });
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AI", ""); // demo harness off
});

describe("free-tier missing GEMINI_API_KEY", () => {
  it("returns free_unavailable (503) and does NOT burn the user's quota", async () => {
    vi.stubEnv("GEMINI_API_KEY", ""); // server misconfiguration
    const res = await POST(post({ provider: "graphe_free", taskType: "background", prompt: "x" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("free_unavailable");
    // The heart of the fix: our misconfiguration must not count against the user.
    expect(checkAndIncrementUsage).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled(); // still logged for ops
  });

  it("with the key present, an over-limit user still gets the hourly-limit message", async () => {
    vi.stubEnv("GEMINI_API_KEY", "real-key");
    checkAndIncrementUsage.mockResolvedValue({ allowed: false, reason: "hourly_limit_reached", resetInMs: 600_000 });
    const res = await POST(post({ provider: "graphe_free", taskType: "background", prompt: "x" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("free_hourly_limit");
    expect(checkAndIncrementUsage).toHaveBeenCalledOnce();
  });
});
