// Shared hook encapsulating AI provider resolution, first-time setup flow, and text generation.

import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import posthog from "posthog-js";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store";
import { buildAiPrompt, wordCount, isLengthAcceptable, lengthCorrectionHint, taskTypeFor } from "@/lib/ai-prompts";
import { getSelectionHtml } from "@/lib/editor-html";
import { isDemoAiEnabled } from "@/lib/ai-demo-mock";
import { executeAiRequest, AI_SETTINGS_QUERY_KEY } from "@/lib/execute-ai-request";

interface AiSettingsResponse {
  activeAiProvider?: string | null;
  hasCompletedAiSetup?: boolean;
  localLlmEndpoint?: string | null;
  localLlmModel?: string | null;
  localLlmApiKey?: string | null;
}

// Local LLMs cost no per-token money, so we give reasoning models room to
// emit their chain-of-thought without truncating mid-thought. Cloud providers
// keep their tighter caps to keep latency and cost predictable. (The request +
// think-tag stripping now live in execute-ai-request.)
const LOCAL_LLM_MAX_TOKENS = 4096;

// G5: generative actions produce NEW content derived from the selection (a summary,
// extracted tasks). Inserting them *after* the selection preserves the source;
// replacing it would destroy the original text the summary was made from.
const GENERATIVE_ACTIONS = new Set([
  "summarize_short", "summarize_balanced", "summarize_detailed", "summarize_custom",
  "extract_action_items",
]);

// G5: sentinel results the model may return that must never be written into the
// document — surface them as a status message instead.
const RESULT_SENTINELS = new Set(["No action items found."]);

// Tester convenience: NEXT_PUBLIC_LOCAL_LLM_DEV_OVERRIDE in .env overrides the
// saved local LLM endpoint at build time. NEXT_PUBLIC_* vars are inlined into
// the bundle, so a Vercel build without it set falls through to the saved URL.
// Lets a tester keep a public tunnel URL stored in their account for prod while
// still hitting localhost in local dev — without flipping settings each time.
const LOCAL_LLM_DEV_ENDPOINT_OVERRIDE =
  process.env.NEXT_PUBLIC_LOCAL_LLM_DEV_OVERRIDE?.replace(/\/+$/, "") || null;

export function useAiAction(
  editor: Editor | null,
  options?: {
    isDemo?: boolean;
    /**
     * Called once just before any AI rewrite request runs. NoteShell uses this
     * to take a "pre_ai_rewrite" version snapshot so the user can always undo
     * an AI change. Should be a no-op outside of full notes (e.g. quick bits).
     */
    onBeforeAiRewrite?: () => Promise<void> | void;
  }
): {
  callAI: (action: string, customInstruction?: string) => Promise<void>;
  cancelAI: () => void;
  aiLoading: boolean;
  aiError: string | null;
  savedAiSelection: MutableRefObject<{ from: number; to: number; text: string } | null>;
  captureSelection: (from: number, to: number, text: string) => void;
} {
  const isDemo = options?.isDemo ?? false;
  const onBeforeAiRewrite = options?.onBeforeAiRewrite;
  // Atomic Zustand selectors (E1) — avoids subscribing the whole store.
  const setAiSetupModalOpen = useAppStore(s => s.setAiSetupModalOpen);
  const setPendingAiAction = useAppStore(s => s.setPendingAiAction);

  const queryClient = useQueryClient();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const savedAiSelection = useRef<{ from: number; to: number; text: string } | null>(null);
  // G1/V9: controller for the in-flight AI request so the user can cancel it
  // (including while waiting out an RPM-429 retry).
  const abortRef = useRef<AbortController | null>(null);

  const captureSelection = (from: number, to: number, text: string) => {
    savedAiSelection.current = { from, to, text };
  };

  const cancelAI = () => {
    abortRef.current?.abort();
  };

  const callAI = async (action: string, customInstruction?: string) => {
    if (!editor) return;

    // Use the selection captured when the toolbar appeared; fall back to current
    // selection. G13: content is HTML (preserves marks + block structure).
    const sel = savedAiSelection.current ?? (() => {
      const { from, to } = editor.state.selection;
      return { from, to, text: getSelectionHtml(editor, from, to) };
    })();

    if (!sel.text.trim()) return;

    const built = buildAiPrompt(action, sel.text, customInstruction);
    if (!built) { setAiLoading(false); return; }
    // G12 (10.1): `system` carries the task instruction (provider system role);
    // `prompt` is the fenced user selection (content to transform, not instructions).
    const { system, content: prompt } = built;

    // G9: demo mode has no authenticated AI backend — hitting /api/ai/generate
    // would 401. Show a friendly upsell instead of a raw auth error. Exception:
    // the demo-AI harness flag (dev/CI) routes demo actions to a mock instead.
    if (isDemo && !isDemoAiEnabled()) {
      setAiLoading(false);
      setAiError("Sign up to use AI features.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }

    // G3/V9: while the (possibly long-waiting) request is in flight the user may
    // keep typing. Compose each transaction's mapping onto the saved positions so
    // we act on the ORIGINAL range, not whatever now sits at the stale offsets.
    const trackSelection = () => {
      let from = sel.from;
      let to = sel.to;
      const onTr = (props: { transaction: { mapping: { map: (pos: number, assoc?: number) => number } } }) => {
        from = props.transaction.mapping.map(from, -1);
        to = props.transaction.mapping.map(to, 1);
      };
      editor!.on("transaction", onTr as never);
      return {
        stop: () => editor!.off("transaction", onTr as never),
        pos: () => ({ from, to }),
      };
    };

    // Insert the AI result: rewrite actions replace the (mapped) selection;
    // generative actions (summarize/extract) insert AFTER it; sentinel results are
    // shown as a status, never written into the document (G5).
    const applyAiResult = (raw: string, from: number, to: number) => {
      const result = raw.trimEnd();
      if (!result.trim()) return;
      if (RESULT_SENTINELS.has(result.trim())) {
        setAiError(result.trim());
        setTimeout(() => setAiError(null), 4000);
        return;
      }
      if (GENERATIVE_ACTIONS.has(action)) {
        editor!.chain().focus().insertContentAt(to, `\n\n${result}`).run();
      } else {
        editor!.chain().focus().insertContentAt({ from, to }, result).run();
      }
    };

    // Take a "pre_ai_rewrite" snapshot of the current note state before we
    // touch anything. Failing the snapshot must NOT block the AI call — the
    // worst case is the user can't undo a single rewrite, which is no worse
    // than today.
    if (onBeforeAiRewrite) {
      try { await onBeforeAiRewrite(); } catch { /* swallow */ }
    }

    // G16 (10.4): route by action + content size instead of hardcoding "manual".
    // The selection's position span (to - from) is a regex-free proxy for the
    // character count — good enough for the fuzzy ~500-char light/primary threshold.
    const taskType = taskTypeFor(action, sel.to - sel.from);

    // Demo-AI harness: run the action against the mock generate endpoint (no auth,
    // no real provider). Exercises the full client → route → editor-insert path so
    // AI is end-to-end testable in demo; the streaming work builds on this branch.
    if (isDemo && isDemoAiEnabled()) {
      setAiLoading(true);
      setAiError(null);
      const tracker = trackSelection();
      try {
        const outcome = await executeAiRequest({ provider: "graphe_free", prompt, system, taskType, action, demoMock: true });
        if (outcome.ok && outcome.text) {
          const { from, to } = tracker.pos();
          applyAiResult(outcome.text, from, to);
        } else if (!outcome.ok) {
          setAiError(outcome.message ?? "AI request failed");
          setTimeout(() => setAiError(null), 4000);
        }
      } finally {
        tracker.stop();
        setAiLoading(false);
        savedAiSelection.current = null;
      }
      return;
    }

    // Fetch active provider from server; default to graphe_free on any failure.
    let provider = "graphe_free";
    let localLlmEndpoint: string | null = null;
    let localLlmModel: string | null = null;
    let localLlmApiKey: string | null = null;
    if (!isDemo) {
      try {
        // G16-partial: cache the settings so rapid successive actions don't each
        // round-trip /api/ai/settings (staleTime); SettingsModal invalidates on save.
        const settingsData = await queryClient.fetchQuery({
          queryKey: AI_SETTINGS_QUERY_KEY,
          queryFn: async () => {
            const r = await authenticatedFetch("/api/ai/settings");
            if (!r.ok) throw new Error("Failed to fetch AI settings");
            return r.json() as Promise<AiSettingsResponse>;
          },
          staleTime: 30_000,
        });
        {

          if (!settingsData.hasCompletedAiSetup) {
            // First AI action — show setup modal and queue this action to run after.
            const capturedPrompt = prompt;
            const capturedSystem = system;
            const capturedFrom = sel.from;
            const capturedTo = sel.to;
            const capturedTaskType = taskType;
            setPendingAiAction(async (resolvedProvider: string) => {
              setAiLoading(true);
              setAiError(null);
              try {
                // Re-fetch settings to get endpoint URL at execution time
                let localLlm: { endpoint: string; model: string | null; apiKey: string | null } | undefined;
                if (resolvedProvider === "local_llm") {
                  // Re-fetch settings to get the endpoint URL at execution time.
                  const freshSettings = await authenticatedFetch("/api/ai/settings");
                  if (!freshSettings.ok) throw new Error("Failed to fetch AI settings");
                  const freshData = await freshSettings.json() as AiSettingsResponse;
                  const normalizedEndpoint =
                    LOCAL_LLM_DEV_ENDPOINT_OVERRIDE ?? freshData.localLlmEndpoint?.replace(/\/+$/, "") ?? null;
                  if (!normalizedEndpoint) {
                    setAiError("Local LLM endpoint not configured. Please check Settings.");
                    setTimeout(() => setAiError(null), 5000);
                    return;
                  }
                  localLlm = { endpoint: normalizedEndpoint, model: freshData.localLlmModel ?? null, apiKey: freshData.localLlmApiKey ?? null };
                }

                const outcome = await executeAiRequest({
                  provider: resolvedProvider,
                  prompt: capturedPrompt,
                  system: capturedSystem,
                  taskType: capturedTaskType,
                  action,
                  localLlm,
                  localMaxTokens: LOCAL_LLM_MAX_TOKENS,
                });
                if (!outcome.ok) {
                  const msg = outcome.message ?? "AI request failed";
                  setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
                  setTimeout(() => setAiError(null), 5000);
                } else if (outcome.text && editor) {
                  applyAiResult(outcome.text, capturedFrom, capturedTo);
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : "AI request failed";
                setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
                setTimeout(() => setAiError(null), 5000);
              } finally {
                setAiLoading(false);
                savedAiSelection.current = null;
              }
            });
            setAiSetupModalOpen(true);
            return;
          }

          if (!settingsData.activeAiProvider) return; // No AI mode — silently cancel
          provider = settingsData.activeAiProvider;
          localLlmEndpoint = settingsData.localLlmEndpoint ?? null;
          localLlmModel = settingsData.localLlmModel ?? null;
          localLlmApiKey = settingsData.localLlmApiKey ?? null;
        }
      } catch { /* use default */ }
    }

    // --- Local LLM: call inference server directly from the client ---
    if (provider === "local_llm") {
      // Dev override (from .env) wins; otherwise use the saved endpoint.
      // Strip trailing slashes defensively for endpoints saved before normalization existed.
      const normalizedEndpoint =
        LOCAL_LLM_DEV_ENDPOINT_OVERRIDE ?? localLlmEndpoint?.replace(/\/+$/, "") ?? null;
      if (!normalizedEndpoint) {
        setAiError("Local LLM endpoint not configured. Please check Settings.");
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      setAiLoading(true);
      setAiError(null);
      const tracker = trackSelection();
      try {
        const outcome = await executeAiRequest({
          provider,
          prompt,
          system,
          taskType,
          action,
          localLlm: { endpoint: normalizedEndpoint, model: localLlmModel, apiKey: localLlmApiKey },
          localMaxTokens: LOCAL_LLM_MAX_TOKENS,
        });
        if (!outcome.ok) {
          const msg = outcome.message ?? "AI request failed";
          setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
          setTimeout(() => setAiError(null), 5000);
        } else if (outcome.text) {
          const { from, to } = tracker.pos();
          applyAiResult(outcome.text, from, to);
        }
      } finally {
        tracker.stop();
        setAiLoading(false);
        savedAiSelection.current = null;
      }
      return;
    }

    // --- Cloud providers: route through /api/ai/generate ---
    posthog.capture("ai_selection_action_triggered", { action, provider });
    setAiLoading(true);
    setAiError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const tracker = trackSelection();

    // Abortable wait — rejects with an AbortError if the user cancels mid-retry.
    const abortableDelay = (ms: number) => new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      controller.signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });

    try {
      let outcome = await executeAiRequest({ provider, prompt, system, taskType, action, signal: controller.signal });

      // G1: on an RPM-429 the server tells us how long to wait; retry ONCE.
      if (!outcome.ok && outcome.retryDelayMs != null) {
        setAiError(`AI is busy — retrying in ${Math.ceil(outcome.retryDelayMs / 1000)}s… (tap ✕ to cancel)`);
        await abortableDelay(outcome.retryDelayMs);
        setAiError("Retrying…");
        outcome = await executeAiRequest({ provider, prompt, system, taskType, action, signal: controller.signal });
        if (!outcome.ok && outcome.retryDelayMs != null) {
          setAiError("AI is still busy. Please try again in a moment.");
          setTimeout(() => setAiError(null), 5000);
          return;
        }
      }

      if (outcome.rateLimit) {
        posthog.capture("ai_rate_limit_reached", { reason: outcome.rateLimit.reason, reset_in_ms: outcome.rateLimit.resetInMs });
      }

      if (!outcome.ok) {
        const msg = outcome.message ?? "AI request failed";
        setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      // G14 (10.3): validate length for shorten/lengthen actions. If the result
      // went the wrong direction (e.g. "25% shorter" came back longer), re-request
      // ONCE with a corrective target before giving up on the length.
      if (outcome.ok && outcome.text && !isLengthAcceptable(action, wordCount(sel.text), wordCount(outcome.text))) {
        const correctiveSystem = `${system ?? ""}\n\n${lengthCorrectionHint(action, wordCount(sel.text))}`.trim();
        setAiError("Adjusting length…");
        const retry = await executeAiRequest({ provider, prompt, system: correctiveSystem, taskType, action, signal: controller.signal });
        if (retry.ok && retry.text) outcome = retry;
        setAiError(null);
      }

      if (outcome.text) {
        const { from, to } = tracker.pos();
        applyAiResult(outcome.text, from, to);
      }
    } catch (err) {
      // User-initiated cancel — abort the flow silently, no error banner.
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "AI request failed";
      setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setTimeout(() => setAiError(null), 5000);
    } finally {
      tracker.stop();
      setAiLoading(false);
      abortRef.current = null;
      savedAiSelection.current = null;
    }
  };

  return { callAI, cancelAI, aiLoading, aiError, savedAiSelection, captureSelection };
}
