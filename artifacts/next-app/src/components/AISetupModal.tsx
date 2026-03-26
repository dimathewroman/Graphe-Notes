"use client";

import { useState } from "react";
import { ShieldOff, Sparkles, Key, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";

export function AISetupModal() {
  const {
    isAiSetupModalOpen,
    pendingAiAction,
    setAiSetupModalOpen,
    setPendingAiAction,
    setSettingsOpen,
  } = useAppStore();

  const [saving, setSaving] = useState(false);

  if (!isAiSetupModalOpen) return null;

  const saveSettings = async (activeAiProvider: string | null) => {
    await authenticatedFetch("/api/ai/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeAiProvider, hasCompletedAiSetup: true }),
    });
  };

  const close = () => {
    setAiSetupModalOpen(false);
    setPendingAiAction(null);
  };

  const handleNoAI = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveSettings(null);
    } finally {
      setSaving(false);
    }
    close();
  };

  const handleSmart = async () => {
    if (saving) return;
    setSaving(true);
    const action = pendingAiAction;
    try {
      await saveSettings("graphe_free");
    } finally {
      setSaving(false);
    }
    setAiSetupModalOpen(false);
    setPendingAiAction(null);
    if (action) await action("graphe_free");
  };

  const handlePower = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveSettings(null);
    } finally {
      setSaving(false);
    }
    setAiSetupModalOpen(false);
    setPendingAiAction(null);
    setSettingsOpen(true, "ai");
  };

  return (
    <AnimatePresence>
      {isAiSetupModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="bg-panel border border-panel-border rounded-2xl w-full max-w-md shadow-2xl pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-panel-border">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Choose your AI mode</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This setting can be changed any time in Settings → AI.
                  </p>
                </div>
                <button
                  onClick={close}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-panel-border transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Cards */}
              <div className="p-4 space-y-2">
                {/* No AI */}
                <button
                  onClick={handleNoAI}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all w-full disabled:opacity-60",
                    "border-panel-border bg-background hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ShieldOff className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">No AI</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI features are fully disabled. Nothing is sent to any AI service.
                  </p>
                </button>

                {/* Smart (recommended) */}
                <button
                  onClick={handleSmart}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all w-full disabled:opacity-60",
                    "border-primary/30 bg-background hover:border-primary/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Smart</span>
                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-medium">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Uses Graphe&apos;s built-in AI. Free to use. Note content may be used by Google to improve their models.
                  </p>
                  <p className="text-xs text-muted-foreground border-t border-panel-border pt-2 mt-0.5 w-full leading-relaxed">
                    Note content sent to Gemini may be used by Google to improve their models.
                  </p>
                </button>

                {/* Power */}
                <button
                  onClick={handlePower}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-start gap-1.5 p-4 rounded-xl border text-left transition-all w-full disabled:opacity-60",
                    "border-panel-border bg-background hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Power</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Use your own API key for full control. Bring your own Gemini, OpenAI, or Anthropic key.
                  </p>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
