// G5 / Phase 8.3: rewrite actions replace the selection; generative actions
// (summarize/extract) insert AFTER it; sentinel results are never written.
import { describe, it, expect, vi, beforeEach } from "vitest";
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
    on: () => {},
    off: () => {},
    state: { selection: { from: 0, to: 5 }, doc: { textBetween: () => "hello" } },
    chain: () => chain,
  } as never;
}

function res(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

async function runAction(action: string, result: string) {
  authenticatedFetch.mockReset();
  authenticatedFetch
    .mockResolvedValueOnce(res(200, { hasCompletedAiSetup: true, activeAiProvider: "graphe_free" }))
    .mockResolvedValueOnce(res(200, { result }));
  const { result: hook } = renderHook(() => useAiAction(makeEditor()), { wrapper: makeWrapper() });
  act(() => hook.current.captureSelection(0, 5, "hello"));
  await act(async () => { await hook.current.callAI(action); });
}

describe("applyAiResult (G5, 8.3)", () => {
  beforeEach(() => insertSpy.mockReset());

  it("rewrite action replaces the selection range", async () => {
    await runAction("improve", "better text");
    expect(insertSpy).toHaveBeenCalledTimes(1);
    // Replace: first arg is a {from,to} range.
    expect(insertSpy).toHaveBeenCalledWith({ from: 0, to: 5 }, "better text");
  });

  it("generative action (summarize) inserts AFTER the selection, not replacing it", async () => {
    await runAction("summarize_short", "a summary");
    expect(insertSpy).toHaveBeenCalledTimes(1);
    // Insert-after: first arg is the numeric end position, content prefixed with newlines.
    expect(insertSpy).toHaveBeenCalledWith(5, "\n\na summary");
  });

  it("never writes the 'No action items found.' sentinel into the document", async () => {
    await runAction("extract_action_items", "No action items found.");
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
