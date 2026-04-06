import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const words = trimmed ? trimmed.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length : 0;
  const chars = text.length;
  const readTime = Math.floor(words / 200);
  return { words, chars, readTime, isSelection: !empty };
}

interface WordCountPopoverProps {
  editor: Editor | null;
}

export function WordCountPopover({ editor }: WordCountPopoverProps) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({ words: 0, chars: 0, readTime: 1, isSelection: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const triggerRect = button.getBoundingClientRect();
    const menuW = menu.offsetWidth || 192;
    const menuH = menu.offsetHeight || 120;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Align right edge of menu with right edge of button (mirrors old "right-0")
    let left = triggerRect.right - menuW;
    let top = triggerRect.bottom + 6;
    if (left + menuW > vw - pad) left = vw - pad - menuW;
    if (left < pad) left = pad;
    if (top + menuH > vh - pad) top = triggerRect.top - menuH - 6;
    if (top < pad) top = pad;
    setPos({ top, left });
  }, [open]);

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

  // Click outside to close — check both the button wrapper and the portal menu
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
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
        ref={buttonRef}
        onClick={() => { refresh(); setOpen((v) => !v); }}
        title="Word count"
        className={cn(
          "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex items-center justify-center",
          open && "bg-panel text-primary"
        )}
      >
        <Hash className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 bg-popover border border-panel-border rounded-xl shadow-2xl p-3 w-48"
          style={{ top: pos.top, left: pos.left }}
        >
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
              <span className="text-xs font-semibold">{counts.readTime < 1 ? "<1 min" : `${counts.readTime} min`}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
