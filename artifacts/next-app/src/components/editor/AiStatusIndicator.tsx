// Floating AI loading / error banner shown while an AI action is running.

import { Loader2, X } from "lucide-react";

export function AiStatusIndicator({ aiLoading, aiError }: {
  aiLoading: boolean;
  aiError: string | null;
}) {
  if (!aiLoading && !aiError) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      {aiLoading ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-indigo-500/30 rounded-full shadow-xl text-indigo-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">AI is rewriting…</span>
        </div>
      ) : aiError ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-destructive/30 rounded-full shadow-xl text-destructive pointer-events-auto">
          <X className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">{aiError}</span>
        </div>
      ) : null}
    </div>
  );
}
