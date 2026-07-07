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

  it("surfaces an RPM-429 with retryDelayMs so the hook can retry", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rpm_limit", retryAfterMs: 1500 }), { status: 429 }),
    );
    const outcome = await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual" },
      () => {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.retryDelayMs).toBe(1500);
  });

  it("maps a monthly limit to a friendly message + rateLimit", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ reason: "monthly_limit_reached" }), { status: 429 }),
    );
    const outcome = await executeAiStreamRequest(
      { provider: "graphe_free", prompt: "x", taskType: "manual" },
      () => {},
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.rateLimit?.reason).toBe("monthly_limit_reached");
  });
});
