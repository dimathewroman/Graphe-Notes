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

const insertSpy = vi.fn();
function makeEditor() {
  const chain: Record<string, (...a: unknown[]) => unknown> = {};
  chain.focus = () => chain;
  chain.insertContentAt = (...a: unknown[]) => { insertSpy(...a); return chain; };
  chain.run = () => true;
  return {
    on: () => {}, off: () => {},
    state: { selection: { from: 0, to: 5 }, doc: { textBetween: () => "hello" } },
    chain: () => chain,
  } as never;
}
function res(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
beforeEach(() => { insertSpy.mockReset(); authenticatedFetch.mockReset(); });

async function run(action: string, opts?: { isDemo?: boolean }) {
  const { result } = renderHook(() => useAiAction(makeEditor(), opts), { wrapper: makeWrapper() });
  act(() => result.current.captureSelection(0, 5, "hello"));
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

  it("cloud success inserts the result", async () => {
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(res(200, { result: "better" }));
    await run("improve");
    expect(insertSpy).toHaveBeenCalledWith({ from: 0, to: 5 }, "better");
  });

  it("truncation surfaces the friendly userMessage, not the code", async () => {
    authenticatedFetch
      .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
      .mockResolvedValueOnce(res(200, { error: "output_truncated", userMessage: "too long, friend" }));
    const r = await run("longer_50");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(r.current.aiError).toBe("too long, friend");
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
