// Floating AI loading / error banner shown while an AI action is running.

import { Loader2, X } from "lucide-react";

export function AiStatusIndicator({ aiLoading, aiError, onCancel }: {
  aiLoading: boolean;
  aiError: string | null;
  onCancel?: () => void;
}) {
  if (!aiLoading && !aiError) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      {aiLoading ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-ai-accent/30 rounded-full shadow-xl text-ai-accent pointer-events-auto">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="text-xs font-medium whitespace-nowrap">AI is rewriting…</span>
          {onCancel && (
            <button
              onClick={onCancel}
              aria-label="Cancel AI request"
              className="ml-0.5 -mr-1.5 p-1 rounded-full text-ai-accent/70 hover:text-ai-accent hover:bg-ai-accent/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
