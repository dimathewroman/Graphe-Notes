import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface Counts {
  words: number;
  chars: number;
  readTime: number;
  isSelection: boolean;
}

function computeCounts(editor: Editor): Counts {
  const { from, to, empty } = editor.state.selection;
  const text = empty
    ? editor.state.doc.textContent
    : editor.state.doc.textBetween(from, to);
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const readTime = Math.max(1, Math.ceil(words / 200));
  return { words, chars, readTime, isSelection: !empty };
}

interface WordCountPopoverProps {
  editor: Editor | null;
}

export function WordCountPopover({ editor }: WordCountPopoverProps) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({ words: 0, chars: 0, readTime: 1, isSelection: false });
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    if (!editor) return;
    setCounts(computeCounts(editor));
  }, [editor]);

  // Keep counts in sync with editor state
  useEffect(() => {
    if (!editor) return;
    editor.on("update", refresh);
    editor.on("selectionUpdate", refresh);
    refresh();
    return () => {
      editor.off("update", refresh);
      editor.off("selectionUpdate", refresh);
    };
  }, [editor, refresh]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  if (!editor) return null;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        onClick={() => { refresh(); setOpen((v) => !v); }}
        title="Word count"
        className={cn(
          "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex items-center justify-center",
          open && "bg-panel text-primary"
        )}
      >
        <Hash className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-40 bg-popover border border-panel-border rounded-xl shadow-2xl p-3 w-48">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            {counts.isSelection ? "Selection" : "Document"}
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Words</span>
              <span className="text-xs font-semibold tabular-nums">{counts.words.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Characters</span>
              <span className="text-xs font-semibold tabular-nums">{counts.chars.toLocaleString()}</span>
            </div>
            <div className="h-px bg-panel-border" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Read time</span>
              <span className="text-xs font-semibold">{counts.readTime} min</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
