// Demo-AI harness (dev/CI): pins the deterministic mock contract the e2e suite
// and the future streaming work rely on.
import { describe, it, expect, afterEach, vi } from "vitest";
import { mockAiText, mockGenerateBody, mockStreamDeltas, isDemoAiEnabled, DEMO_AI_HEADER } from "@/lib/ai-demo-mock";

afterEach(() => vi.unstubAllEnvs());

describe("demo-AI mock", () => {
  it("produces deterministic, action-tagged text", () => {
    expect(mockAiText("improve")).toBe("Mock AI response for improve.");
    expect(mockAiText()).toBe("Mock AI response.");
    // Deterministic — same input, same output (no randomness / no real model).
    expect(mockAiText("proofread")).toBe(mockAiText("proofread"));
  });

  it("returns the current /api/ai/generate response shape", () => {
    expect(mockGenerateBody("summarize_short")).toEqual({
      result: "Mock AI response for summarize_short.",
      model: "mock",
      tokensUsed: { inputTokens: 0, outputTokens: 0 },
    });
  });

  it("isDemoAiEnabled reflects the build flag", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AI", "1");
    expect(isDemoAiEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AI", "");
    expect(isDemoAiEnabled()).toBe(false);
  });

  it("uses a stable header name", () => {
    expect(DEMO_AI_HEADER).toBe("x-graphe-demo-ai");
  });

  it("streams deltas that reconstruct the full canned text", () => {
    const deltas = mockStreamDeltas("proofread");
    expect(deltas.length).toBeGreaterThan(1); // genuinely chunked
    expect(deltas.join("")).toBe(mockAiText("proofread"));
  });
});
