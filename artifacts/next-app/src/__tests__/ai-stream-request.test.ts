// executeAiStreamRequest (9.3): the client SSE consumer. Pins that it yields
// deltas + returns the full text on success, and that errors (esp. RPM-429)
// surface the same shape as the one-shot path so the hook's retry still works.
import { describe, it, expect, vi, beforeEach } from "vitest";

const authenticatedFetch = vi.fn();
vi.mock("@workspace/api-client-react/custom-fetch", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));

import { executeAiStreamRequest } from "@/lib/execute-ai-request";

function sseResponse(frames: string[]): Response {
  const enc = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < frames.length) controller.enqueue(enc.encode(frames[i++]));
      else controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

beforeEach(() => authenticatedFetch.mockReset());

describe("executeAiStreamRequest", () => {
  it("yields each delta and resolves with the full accumulated text", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      sseResponse(['data: {"delta":"Hello, "}\n\n', 'data: {"delta":"world"}\n\n', "data: [DONE]\n\n"]),
    );
    const deltas: string[] = [];
    const outcome = await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual" },
      (d) => deltas.push(d),
    );
    expect(deltas).toEqual(["Hello, ", "world"]);
    expect(outcome).toEqual({ ok: true, text: "Hello, world" });
  });

  it("sends stream:true and the demo header when demoMock is set", async () => {
    authenticatedFetch.mockResolvedValueOnce(sseResponse(["data: [DONE]\n\n"]));
    await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual", demoMock: true },
      () => {},
    );
    const [, init] = authenticatedFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).stream).toBe(true);
    expect((init.headers as Record<string, string>)["x-graphe-demo-ai"]).toBe("1");
  });

  it("surfaces a per-minute limit with retryDelayMs so the hook can retry", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "provider_rpm", userMessage: "Gemini is busy right now. Retrying in a moment…", retryAfterMs: 1500 }), { status: 429 }),
    );
    const outcome = await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual" },
      () => {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.retryDelayMs).toBe(1500);
  });

  it("a daily quota is NOT auto-retried (no retryDelayMs) and shows its own message", async () => {
    // Regression: a per-day limit used to be mislabeled per-minute and retried forever.
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "provider_daily_quota", userMessage: "You've hit Gemini's daily limit for gemini-2.5-flash. It resets around midnight Pacific." }), { status: 429 }),
    );
    const outcome = await executeAiStreamRequest(
      { provider: "google_ai_studio", prompt: "x", taskType: "manual" },
      () => {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.retryDelayMs).toBeUndefined(); // terminal — never auto-retries
    expect(outcome.message).toMatch(/daily limit/i);
  });

  it("maps a monthly free-tier limit to its message + rateLimit telemetry", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "free_capacity", userMessage: "Free AI is at capacity this month. Add your own API key in Settings for unlimited use.", reason: "monthly_limit_reached" }), { status: 429 }),
    );
    const outcome = await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual" },
      () => {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.rateLimit?.reason).toBe("monthly_limit_reached");
  });

  it("a clean stream that yields zero tokens surfaces stream_empty, not silence", async () => {
    authenticatedFetch.mockResolvedValueOnce(sseResponse(["data: [DONE]\n\n"]));
    const outcome = await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual" },
      () => {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/returned nothing/i);
  });
});
