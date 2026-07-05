// Shared hook encapsulating AI provider resolution, first-time setup flow, and text generation.

import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import posthog from "posthog-js";
import { useAppStore } from "@/store";
import { buildAiPrompt } from "@/lib/ai-prompts";

interface AiSettingsResponse {
  activeAiProvider?: string | null;
  hasCompletedAiSetup?: boolean;
  localLlmEndpoint?: string | null;
  localLlmModel?: string | null;
  localLlmApiKey?: string | null;
}

interface LocalLlmChatResponse {
  choices: Array<{ message: { content: string } }>;
}

// Local LLMs cost no per-token money, so we give reasoning models room to
// emit their chain-of-thought without truncating mid-thought. Cloud providers
// keep their tighter caps to keep latency and cost predictable.
const LOCAL_LLM_MAX_TOKENS = 4096;

// Strip <think>...</think> blocks emitted by reasoning models (DeepSeek R1,
// Qwen3 thinking variants, etc.) before inserting the result into the editor.
// Without this the user sees the model's internal monologue in their note.
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trimStart();
}

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

    // Use the selection captured when the toolbar appeared; fall back to current selection.
    const sel = savedAiSelection.current ?? (() => {
      const { from, to } = editor.state.selection;
      return { from, to, text: editor.state.doc.textBetween(from, to) };
    })();

    if (!sel.text.trim()) return;

    const prompt = buildAiPrompt(action, sel.text, customInstruction);
    if (!prompt) { setAiLoading(false); return; }

    // G9: demo mode has no authenticated AI backend — hitting /api/ai/generate
    // would 401. Show a friendly upsell instead of a raw auth error.
    if (isDemo) {
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

    const taskType = "manual";

    // Fetch active provider from server; default to graphe_free on any failure.
    let provider = "graphe_free";
    let localLlmEndpoint: string | null = null;
    let localLlmModel: string | null = null;
    let localLlmApiKey: string | null = null;
    if (!isDemo) {
      try {
        const settingsRes = await authenticatedFetch("/api/ai/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json() as AiSettingsResponse;

          if (!settingsData.hasCompletedAiSetup) {
            // First AI action — show setup modal and queue this action to run after.
            const capturedPrompt = prompt;
            const capturedFrom = sel.from;
            const capturedTo = sel.to;
            const capturedTaskType = taskType;
            setPendingAiAction(async (resolvedProvider: string) => {
              setAiLoading(true);
              setAiError(null);
              try {
                // Re-fetch settings to get endpoint URL at execution time
                if (resolvedProvider === "local_llm") {
                  const freshSettings = await authenticatedFetch("/api/ai/settings");
                  if (!freshSettings.ok) throw new Error("Failed to fetch AI settings");
                  const freshData = await freshSettings.json() as AiSettingsResponse;
                  // Dev override (from .env) wins; otherwise use the saved endpoint.
                  // Strip trailing slashes defensively for endpoints saved before normalization existed.
                  const normalizedEndpoint =
                    LOCAL_LLM_DEV_ENDPOINT_OVERRIDE ?? freshData.localLlmEndpoint?.replace(/\/+$/, "") ?? null;
                  if (!normalizedEndpoint) {
                    setAiError("Local LLM endpoint not configured. Please check Settings.");
                    setTimeout(() => setAiError(null), 5000);
                    return;
                  }
                  const freshHeaders: Record<string, string> = { "Content-Type": "application/json" };
                  if (freshData.localLlmApiKey) freshHeaders["Authorization"] = `Bearer ${freshData.localLlmApiKey}`;
                  const res = await fetch(`${normalizedEndpoint}/v1/chat/completions`, {
                    method: "POST",
                    headers: freshHeaders,
                    body: JSON.stringify({
                      model: freshData.localLlmModel ?? "default",
                      messages: [{ role: "user", content: capturedPrompt }],
                      max_tokens: LOCAL_LLM_MAX_TOKENS,
                      stream: false,
                    }),
                  });
                  if (!res.ok) throw new Error("Local LLM returned an error");
                  const data = await res.json() as LocalLlmChatResponse;
                  const result = stripThinkTags(data.choices[0]?.message?.content ?? "");
                  if (result && editor) {
                    applyAiResult(result, capturedFrom, capturedTo);
                  }
                  return;
                }

                const res = await authenticatedFetch("/api/ai/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ provider: resolvedProvider, taskType: capturedTaskType, prompt: capturedPrompt }),
                });
                if (!res.ok) {
                  setAiError("AI request failed. Please try again.");
                  setTimeout(() => setAiError(null), 5000);
                  return;
                }
                const data = await res.json() as { result?: string; error?: string; userMessage?: string };
                if (data.error) throw new Error(data.userMessage ?? data.error);
                const result = data.result || "";
                if (result && editor) {
                  applyAiResult(result, capturedFrom, capturedTo);
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
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (localLlmApiKey) headers["Authorization"] = `Bearer ${localLlmApiKey}`;
        const res = await fetch(`${normalizedEndpoint}/v1/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: localLlmModel ?? "default",
            messages: [{ role: "user", content: prompt }],
            max_tokens: LOCAL_LLM_MAX_TOKENS,
            stream: false,
          }),
        });
        if (!res.ok) throw new Error("Local LLM returned an error");
        const data = await res.json() as LocalLlmChatResponse;
        const result = stripThinkTags(data.choices[0]?.message?.content ?? "");
        if (result) {
          const { from, to } = tracker.pos();
          applyAiResult(result, from, to);
        }
      } catch (err) {
        const isNetworkError = err instanceof TypeError;
        const msg = isNetworkError
          ? "Could not reach local LLM. Make sure your inference server is running."
          : err instanceof Error ? err.message : "AI request failed";
        setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
        setTimeout(() => setAiError(null), 5000);
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

    const doRequest = async (): Promise<Response> => {
      return authenticatedFetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, taskType, prompt }),
        signal: controller.signal,
      });
    };

    // Abortable wait — rejects with an AbortError if the user cancels mid-retry.
    const abortableDelay = (ms: number) => new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      controller.signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });

    try {
      let res = await doRequest();

      if (res.status === 429) {
        const data = await res.json() as { error?: string; reason?: string; resetInMs?: number; retryAfterMs?: number };
        // G1: the upstream RPM-429 arrives as `error: "rpm_limit"` + retryAfterMs;
        // the app-key rate limits arrive as `reason` + resetInMs. Branch on either.
        const kind = data.error ?? data.reason;
        if (kind === "rpm_limit") {
          // Sleep the server-provided delay (was a hardcoded 65s), then retry ONCE.
          const delayMs = data.retryAfterMs ?? data.resetInMs ?? 60000;
          setAiError(`AI is busy — retrying in ${Math.ceil(delayMs / 1000)}s… (tap ✕ to cancel)`);
          await abortableDelay(delayMs);
          setAiError("Retrying…");
          res = await doRequest();
          if (res.status === 429) {
            setAiError("AI is still busy. Please try again in a moment.");
            setTimeout(() => setAiError(null), 5000);
            return;
          }
        } else if (kind === "hourly_limit_reached") {
          posthog.capture("ai_rate_limit_reached", { reason: "hourly_limit_reached", reset_in_ms: data.resetInMs });
          const resetMins = Math.ceil((data.resetInMs ?? 0) / 60000);
          setAiError(`You've reached your hourly AI limit. Resets in ${resetMins} minutes.`);
          setTimeout(() => setAiError(null), 5000);
          return;
        } else if (data.reason === "monthly_limit_reached") {
          posthog.capture("ai_rate_limit_reached", { reason: "monthly_limit_reached" });
          setAiError("Monthly AI limit reached. Add your own API key in Settings for unlimited use.");
          setTimeout(() => setAiError(null), 6000);
          return;
        }
      }

      if (res.status === 400) {
        const data = await res.json() as { error?: string };
        if (data.error === "no_key_configured") {
          setAiError("No API key configured. Please add one in Settings.");
          setTimeout(() => setAiError(null), 5000);
          return;
        }
      }

      if (res.status === 401) {
        setAiError("AI key invalid or missing. Check Settings.");
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      if (res.status === 502) {
        setAiError("AI request failed. Please try again.");
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      const data = await res.json() as { error?: string; result?: string; userMessage?: string };
      if (data.error) throw new Error(data.userMessage ?? data.error);
      const result: string = data.result || "";
      if (result) {
        const { from, to } = tracker.pos();
        applyAiResult(result, from, to);
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
