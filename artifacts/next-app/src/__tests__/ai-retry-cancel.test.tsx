// G1 / Phase 8.1: an RPM-429 must retry exactly once after the *server-provided*
// delay (not a hardcoded 65s), and a cancel must abort the in-flight request.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const authenticatedFetch = vi.fn();
vi.mock("@workspace/api-client-react/custom-fetch", () => ({
  authenticatedFetch: (...args: unknown[]) => authenticatedFetch(...args),
}));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("@/store", () => ({
  useAppStore: (sel: (s: unknown) => unknown) =>
    sel({ setAiSetupModalOpen: vi.fn(), setPendingAiAction: vi.fn() }),
}));

import { useAiAction } from "@/hooks/use-ai-action";

function makeEditor() {
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  chain.focus = () => chain;
  chain.insertContentAt = () => chain;
  chain.deleteRange = () => chain;
  // Cloud path streams via chain().command(({tr}) => tr.insertText(...)).
  chain.command = (fn: unknown) => { (fn as (a: { tr: { insertText: () => void; delete: () => void } }) => void)({ tr: { insertText: () => {}, delete: () => {} } }); return chain; };
  chain.run = () => true;
  return {
    on: () => {},
    off: () => {},
    state: { selection: { from: 0, to: 5 }, doc: { textBetween: () => "hello" } },
    chain: () => chain,
  } as never;
}

function res(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

// Streaming success response: SSE `data: {"delta"}` frames + [DONE].
function sseRes(deltas: string[]): Response {
  const enc = new TextEncoder();
  const frames = [...deltas.map((d) => `data: ${JSON.stringify({ delta: d })}\n\n`), "data: [DONE]\n\n"];
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < frames.length) controller.enqueue(enc.encode(frames[i++]));
      else controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const generateCalls = () =>
  authenticatedFetch.mock.calls.filter((c) => c[0] === "/api/ai/generate");

describe("AI RPM-429 retry + cancel (G1, 8.1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    authenticatedFetch.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("retries exactly once after the server's retryAfterMs, then succeeds", async () => {
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(res(429, { error: "rpm_limit", retryAfterMs: 1000 }))
      .mockResolvedValueOnce(sseRes(["improved"]));

    const { result } = renderHook(() => useAiAction(makeEditor()), { wrapper: makeWrapper() });
    act(() => result.current.captureSelection(0, 5, "hello"));

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.callAI("improve");
    });
    // One generate attempt so far (the 429); retry is still waiting on the timer.
    expect(generateCalls().length).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await done;
    });
    // Exactly one retry — two generate calls total.
    expect(generateCalls().length).toBe(2);
  });

  it("cancel aborts the request mid-retry-wait (no second attempt)", async () => {
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(res(429, { error: "rpm_limit", retryAfterMs: 60000 }));

    const { result } = renderHook(() => useAiAction(makeEditor()), { wrapper: makeWrapper() });
    act(() => result.current.captureSelection(0, 5, "hello"));

    let done!: Promise<void>;
    await act(async () => {
      done = result.current.callAI("improve");
    });
    expect(generateCalls().length).toBe(1);

    // Cancel while waiting out the 60s retry delay — no second generate call.
    await act(async () => {
      result.current.cancelAI();
      await done;
    });
    expect(generateCalls().length).toBe(1);
  });
});
