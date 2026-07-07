// Phase 9 safety net: pin the user-visible behaviors of callAI (Phase 8) BEFORE
// the 9.1 executeAiRequest consolidation, so a regression trips a test rather than
// shipping green (the e2e suite runs in demo mode and never exercises real AI).
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

const insertSpy = vi.fn();  // insertContentAt — local & generative-demo paths
const streamSpy = vi.fn();  // tr.insertText — cloud streaming path
function makeEditor() {
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  chain.focus = () => chain;
  chain.insertContentAt = (...a: unknown[]) => { insertSpy(...a); return chain; };
  chain.deleteRange = () => chain;
  chain.command = (fn: unknown) => {
    (fn as (a: { tr: { insertText: (...x: unknown[]) => void; delete: () => void } }) => void)({
      tr: { insertText: (...x: unknown[]) => streamSpy(...x), delete: () => {} },
    });
    return chain;
  };
  chain.run = () => true;
  return {
    on: () => {}, off: () => {},
    state: { selection: { from: 0, to: 5 }, doc: { textBetween: () => "hello" } },
    chain: () => chain,
  } as never;
}
// The final tr.insertText carries the full streamed text (replace-whole-region).
const streamedText = () => streamSpy.mock.calls.at(-1)?.[0];
function res(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}
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

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.unstubAllEnvs(); });
// These tests assert the normal demo behavior ("Sign up"), so pin the demo-AI
// harness flag OFF regardless of ambient env (the CI e2e job sets it globally).
beforeEach(() => { insertSpy.mockReset(); streamSpy.mockReset(); authenticatedFetch.mockReset(); vi.stubEnv("NEXT_PUBLIC_ENABLE_DEMO_AI", ""); });

async function run(action: string, opts?: { isDemo?: boolean }, selection = "hello") {
  const { result } = renderHook(() => useAiAction(makeEditor(), opts), { wrapper: makeWrapper() });
  act(() => result.current.captureSelection(0, 5, selection));
  await act(async () => { await result.current.callAI(action); });
  return result;
}

describe("callAI behavior contract (Phase 8 → guarded for Phase 9)", () => {
  it("demo mode makes no request and shows the sign-up upsell", async () => {
    const r = await run("improve", { isDemo: true });
    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(insertSpy).not.toHaveBeenCalled();
    expect(r.current.aiError).toBe("Sign up to use AI features.");
  });

  it("cloud success streams the result into the editor", async () => {
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(sseRes(["bet", "ter"]));
    await run("improve");
    // Deltas accumulate to the full text in the final tr.insertText.
    expect(streamedText()).toBe("better");
  });

  // (Truncation is a one-shot concept — the streaming path has no output_truncated
  // frame; a stream just ends. So that test no longer applies to the cloud path.)

  it("cloud HTML result is finalized via a parsed insertContentAt, not left as literal deltas", async () => {
    // Regression: real providers return HTML (per 10.2). The streamed deltas are
    // inserted as literal text for live progress, but the FINAL content must be
    // re-derived authoritatively from the full result and HTML-parsed — otherwise
    // tags render as literal text and a per-delta boundary can strand a fragment
    // (the ">4<" / ">-<" orphan seen with the old whole-region rewrite + finalize).
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      // split mid-tag so a naive finalize would strand the boundary char
      .mockResolvedValueOnce(sseRes(["<p>This is ", "some proofread", " text.</p>"]));
    await run("proofread");
    const full = "<p>This is some proofread text.</p>";
    // Finalize overwrote the streamed span with the full HTML over an explicit range.
    const finalize = insertSpy.mock.calls.at(-1);
    expect(finalize?.[0]).toMatchObject({ from: expect.any(Number), to: expect.any(Number) });
    expect(finalize?.[1]).toBe(full);
    // The last literal insert must NOT be the raw HTML (that would show tags as text).
    expect(streamedText()).not.toBe(full);
  });

  it("hourly rate limit shows a reset message and does not retry", async () => {
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(res(429, { reason: "hourly_limit_reached", resetInMs: 600000 }));
    const r = await run("improve");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(r.current.aiError).toMatch(/hourly AI limit/i);
    // one settings + one generate = 2; no retry
    expect(authenticatedFetch).toHaveBeenCalledTimes(2);
  });

  it("upstream timeout (504) surfaces the friendly userMessage, not a raw code", async () => {
    // G16 (9.3): the server maps a hung provider to 504 { error, userMessage }.
    // runCloud has no explicit 504 branch, so this pins that the fallback still
    // prefers userMessage over the error code.
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(res(504, { error: "upstream_timeout", userMessage: "The AI provider took too long to respond. Please try again." }));
    const r = await run("improve");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(r.current.aiError).toMatch(/took too long/i);
  });

  it("shorten that comes back longer is retried once with a corrective request", async () => {
    // G14 (10.3): 10-word original, first result is longer (12 words) → one
    // corrective retry → shorter result applied. 3 fetches total: settings + 2 generate.
    const original = "one two three four five six seven eight nine ten";
    const tooLong = "a b c d e f g h i j k l"; // 12 words
    const short = "one two three"; // 3 words
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(sseRes([tooLong]))
      .mockResolvedValueOnce(sseRes([short]));
    await run("shorter_25", undefined, original);
    // The corrective stream replaced the too-long one; final text is the short result.
    expect(streamedText()).toBe(short);
    // settings + first generate + corrective generate
    expect(authenticatedFetch).toHaveBeenCalledTimes(3);
  });

  it("shorten that is already shorter is applied without a retry", async () => {
    const original = "one two three four five six seven eight nine ten";
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(sseRes(["one two three"]));
    await run("shorter_25", undefined, original);
    expect(streamedText()).toBe("one two three");
    expect(authenticatedFetch).toHaveBeenCalledTimes(2); // no corrective retry
  });

  it("local LLM: strips <think> blocks and inserts", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      res(200, { hasCompletedAiSetup: true, activeAiProvider: "local_llm", localLlmEndpoint: "http://localhost:1234", localLlmModel: "m" }),
    );
    globalThis.fetch = vi.fn().mockResolvedValue(
      res(200, { choices: [{ message: { content: "<think>reasoning</think>final answer" } }] }),
    ) as never;
    await run("improve");
    expect(insertSpy).toHaveBeenCalledWith({ from: 0, to: 5 }, "final answer");
  });

  it("local LLM unreachable shows a friendly network error", async () => {
    authenticatedFetch.mockResolvedValueOnce(
      res(200, { hasCompletedAiSetup: true, activeAiProvider: "local_llm", localLlmEndpoint: "http://localhost:1234", localLlmModel: "m" }),
    );
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed")) as never;
    const r = await run("improve");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(r.current.aiError).toMatch(/could not reach local llm/i);
  });
});
