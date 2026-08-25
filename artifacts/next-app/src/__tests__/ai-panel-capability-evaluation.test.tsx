import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  executeAiRequest: vi.fn(),
  fetchQuery: vi.fn(),
  invalidateQueries: vi.fn(),
  mutateAsync: vi.fn(),
  capture: vi.fn(),
  setAIPanelOpen: vi.fn(),
  setAiSetupModalOpen: vi.fn(),
  setPendingAiAction: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetNote: () => ({ data: undefined }),
  useUpdateNote: () => ({ mutateAsync: mocks.mutateAsync }),
  getGetNotesQueryKey: () => ["/api/notes"],
}));
vi.mock("@workspace/api-client-react/custom-fetch", () => ({
  authenticatedFetch: (...args: unknown[]) => mocks.authenticatedFetch(...args),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    fetchQuery: (...args: unknown[]) => mocks.fetchQuery(...args),
    invalidateQueries: (...args: unknown[]) => mocks.invalidateQueries(...args),
  }),
}));
vi.mock("@/store", () => ({
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      isAIPanelOpen: true,
      setAIPanelOpen: mocks.setAIPanelOpen,
      selectedNoteId: null,
      activeEditor: null,
      setAiSetupModalOpen: mocks.setAiSetupModalOpen,
      setPendingAiAction: mocks.setPendingAiAction,
    }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useBreakpoint: () => "desktop" }));
vi.mock("@/hooks/use-motion", () => ({
  useAnimationConfig: () => ({ spring: {} }),
}));
vi.mock("@/lib/demo-context", () => ({ useDemoMode: () => false }));
vi.mock("@/lib/ai-demo-mock", () => ({ isDemoAiEnabled: () => false }));
vi.mock("@/lib/execute-ai-request", () => ({
  AI_SETTINGS_QUERY_KEY: ["/api/ai/settings"],
  executeAiRequest: (...args: unknown[]) => mocks.executeAiRequest(...args),
}));
vi.mock("posthog-js", () => ({
  default: { capture: (...args: unknown[]) => mocks.capture(...args) },
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children: React.ReactNode;
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

import { AIPanel } from "@/components/AIPanel";

const SETTINGS_CONFIRMATION_ERROR =
  "Couldn't confirm your AI provider. Please check Settings and try again.";

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, json: async () => body };
}

function renderAndSubmit() {
  render(<AIPanel />);
  const input = screen.getByPlaceholderText("Ask AI...");
  fireEvent.change(input, { target: { value: "Summarize this" } });
  fireEvent.keyDown(input, { key: "Enter" });
}

async function expectSafeUnavailableAlert(message: string) {
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(mocks.executeAiRequest).not.toHaveBeenCalled();
  expect(screen.queryByText("Response")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /insert into note/i }),
  ).not.toBeInTheDocument();
}

describe("AIPanel capability evaluation", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.fetchQuery.mockImplementation(
      async ({ queryFn }: { queryFn: () => unknown }) => queryFn(),
    );
    mocks.executeAiRequest.mockResolvedValue({
      ok: false,
      message: "Unexpected executor call",
    });
  });

  it("shows a safe confirmation alert and makes no request when settings cannot be read", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      response(503, { error: "settings_unavailable" }),
    );

    renderAndSubmit();

    await expectSafeUnavailableAlert(SETTINGS_CONFIRMATION_ERROR);
  });

  it.each([
    [
      "a missing provider",
      { hasCompletedAiSetup: true },
      "AI isn't enabled. Choose a provider in Settings to continue.",
    ],
    [
      "a null provider",
      { hasCompletedAiSetup: true, activeAiProvider: null },
      "AI isn't enabled. Choose a provider in Settings to continue.",
    ],
    [
      "an unknown provider",
      { hasCompletedAiSetup: true, activeAiProvider: "unexpected_provider" },
      "Your selected AI provider is no longer supported. Please choose another provider in Settings.",
    ],
    [
      "a local provider without an endpoint",
      { hasCompletedAiSetup: true, activeAiProvider: "local_llm" },
      "Local LLM endpoint not configured. Please check Settings.",
    ],
  ])(
    "shows a safe alert and makes no request for %s",
    async (_caseName, settings, message) => {
      mocks.authenticatedFetch.mockResolvedValue(response(200, settings));

      renderAndSubmit();

      await expectSafeUnavailableAlert(message);
    },
  );

  it("executes an explicitly selected OpenAI provider", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      response(200, {
        hasCompletedAiSetup: true,
        activeAiProvider: "openai",
      }),
    );
    mocks.executeAiRequest.mockResolvedValue({
      ok: true,
      text: "A safe response",
    });

    renderAndSubmit();

    expect(await screen.findByText("A safe response")).toBeInTheDocument();
    expect(mocks.executeAiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        localLlm: undefined,
      }),
    );
  });

  it("executes a configured local LLM only with its browser-local configuration", async () => {
    mocks.authenticatedFetch.mockResolvedValue(
      response(200, {
        hasCompletedAiSetup: true,
        activeAiProvider: "local_llm",
        localLlmEndpoint: "http://localhost:1234",
        localLlmModel: "qwen",
      }),
    );
    mocks.executeAiRequest.mockResolvedValue({
      ok: true,
      text: "A local response",
    });

    renderAndSubmit();

    expect(await screen.findByText("A local response")).toBeInTheDocument();
    expect(mocks.executeAiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "local_llm",
        localLlm: {
          endpoint: "http://localhost:1234",
          model: "qwen",
          apiKey: null,
        },
      }),
    );
  });
});
