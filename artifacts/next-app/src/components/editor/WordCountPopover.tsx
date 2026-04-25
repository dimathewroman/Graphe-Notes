import { useEffect, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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

export function WordCountPopover({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Counts>({ words: 0, chars: 0, readTime: 1, isSelection: false });

  const refresh = useCallback(() => {
    if (!editor) return;
    setCounts(computeCounts(editor));
  }, [editor]);

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

  if (!editor) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={() => refresh()}
          title="Word count"
          className={cn(
            "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex items-center justify-center",
            open && "bg-panel text-primary"
          )}
        >
          <Hash className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-48 p-3 bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top"
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
      </PopoverContent>
    </Popover>
  );
}
