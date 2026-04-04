// Shared hook encapsulating AI provider resolution, first-time setup flow, and text generation.

import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import posthog from "posthog-js";
import { useAppStore } from "@/store";
import { buildAiPrompt } from "@/lib/ai-prompts";

export function useAiAction(
  editor: Editor | null,
  options?: { isDemo?: boolean }
): {
  callAI: (action: string, customInstruction?: string) => Promise<void>;
  aiLoading: boolean;
  aiError: string | null;
  savedAiSelection: MutableRefObject<{ from: number; to: number; text: string } | null>;
  captureSelection: (from: number, to: number, text: string) => void;
} {
  const isDemo = options?.isDemo ?? false;
  const { setAiSetupModalOpen, setPendingAiAction } = useAppStore();

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const savedAiSelection = useRef<{ from: number; to: number; text: string } | null>(null);

  const captureSelection = (from: number, to: number, text: string) => {
    savedAiSelection.current = { from, to, text };
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

    const taskType = "manual";

    // Fetch active provider from server; default to graphe_free on any failure.
    let provider = "graphe_free";
    if (!isDemo) {
      try {
        const settingsRes = await authenticatedFetch("/api/ai/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json() as {
            activeAiProvider?: string | null;
            hasCompletedAiSetup?: boolean;
          };

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
                const data = await res.json() as { result?: string; error?: string };
                if (data.error) throw new Error(data.error);
                const result = data.result || "";
                if (result && editor) {
                  editor.chain().focus().insertContentAt({ from: capturedFrom, to: capturedTo }, result).run();
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
        }
      } catch { /* use default */ }
    }

    posthog.capture("ai_selection_action_triggered", { action, provider });
    setAiLoading(true);
    setAiError(null);

    const doRequest = async (): Promise<Response> => {
      return authenticatedFetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, taskType, prompt }),
      });
    };

    try {
      let res = await doRequest();

      if (res.status === 429) {
        const data = await res.json() as { reason?: string; resetInMs?: number };
        if (data.reason === "rpm_limit") {
          setAiError("AI is busy, retrying...");
          await new Promise((resolve) => setTimeout(resolve, 65000));
          res = await doRequest();
          if (res.status === 429) {
            setAiError("AI is still busy. Please try again in a moment.");
            setTimeout(() => setAiError(null), 5000);
            return;
          }
        } else if (data.reason === "hourly_limit_reached") {
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

      const data = await res.json() as { error?: string; result?: string };
      if (data.error) throw new Error(data.error);
      const result: string = data.result || "";
      if (result) {
        editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, result).run();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
      savedAiSelection.current = null;
    }
  };

  return { callAI, aiLoading, aiError, savedAiSelection, captureSelection };
}
