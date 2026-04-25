import { useEffect, useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-mobile";
import { FONT_SIZE_PRESETS, DEFAULT_FONT_SIZE } from "./ai-action-groups";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export function FontSizeWidget({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const valueRef = useRef<HTMLButtonElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!editor) return null;

  const rawSize = editor.getAttributes("textStyle").fontSize as string | undefined;
  const getComputedSize = (): number => {
    try {
      const { from } = editor.state.selection;
      const domAtPos = editor.view.domAtPos(from);
      const node = domAtPos.node;
      const el: Element | null = node instanceof Element ? node : node.parentElement;
      if (el) {
        const fs = window.getComputedStyle(el).fontSize;
        const parsed = parseFloat(fs);
        if (!isNaN(parsed) && parsed > 0) return Math.round(parsed);
      }
    } catch {}
    return DEFAULT_FONT_SIZE;
  };
  const currentSize = rawSize ? parseInt(rawSize, 10) : getComputedSize();

  const applySize = (size: number) => {
    editor.chain().focus().setFontSize(`${Math.min(96, Math.max(8, size))}px`).run();
  };

  const nudge = (dir: 1 | -1) => {
    applySize(currentSize + dir);
  };

  const openDropdown = () => setDropdownOpen(true);
  const closeDropdown = () => setDropdownOpen(false);

  const handleHoverEnter = () => {
    if (isMobile) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    openDropdown();
  };

  const handleHoverLeave = () => {
    if (isMobile) return;
    hoverTimerRef.current = setTimeout(closeDropdown, 150);
  };

  const handleValueClick = () => {
    if (isMobile) {
      openDropdown();
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    } else {
      closeDropdown();
      setInputVal(String(currentSize));
      setEditing(true);
    }
  };

  const confirmEdit = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 8 && num <= 96) applySize(num);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inlineInputRef.current?.select();
  }, [editing]);

  return (
    <Popover open={dropdownOpen} onOpenChange={(open) => { if (!open) closeDropdown(); }}>
      <div className="flex items-center shrink-0 rounded border border-panel-border">
        <button
          onClick={() => nudge(-1)}
          className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:w-5 md:h-6 flex items-center justify-center text-muted-foreground hover:bg-panel hover:text-foreground transition-colors text-sm px-1"
          title="Decrease font size"
        >
          −
        </button>

        <div className="w-px h-3.5 bg-panel-border" />

        {editing ? (
          <input
            ref={inlineInputRef}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={() => confirmEdit(inputVal)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmEdit(inputVal); }
              if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
            }}
            className="w-9 text-center text-xs bg-transparent outline-none text-foreground tabular-nums py-1"
          />
        ) : (
          <PopoverAnchor asChild>
            <button
              ref={valueRef}
              onClick={handleValueClick}
              onMouseEnter={handleHoverEnter}
              onMouseLeave={handleHoverLeave}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:w-9 md:h-6 flex items-center justify-center text-xs text-foreground hover:bg-panel transition-colors tabular-nums"
              title="Font size — hover to pick, click to type"
            >
              {currentSize}
            </button>
          </PopoverAnchor>
        )}

        <div className="w-px h-3.5 bg-panel-border" />

        <button
          onClick={() => nudge(1)}
          className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:w-5 md:h-6 flex items-center justify-center text-muted-foreground hover:bg-panel hover:text-foreground transition-colors text-sm px-1"
          title="Increase font size"
        >
          +
        </button>
      </div>

      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={4}
        className="w-20 p-0 py-1.5 max-h-64 overflow-y-auto bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top"
        onMouseEnter={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
        onMouseLeave={handleHoverLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {isMobile && (
          <div className="px-2 pb-1.5 border-b border-panel-border mb-1">
            <input
              ref={mobileInputRef}
              type="number"
              min={8}
              max={96}
              defaultValue={currentSize}
              className="w-full text-center text-xs bg-panel rounded px-1 py-0.5 outline-none text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = parseInt((e.target as HTMLInputElement).value, 10);
                  if (!isNaN(val) && val >= 8 && val <= 96) applySize(val);
                  closeDropdown();
                }
                if (e.key === "Escape") closeDropdown();
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 8 && val <= 96) applySize(val);
                closeDropdown();
              }}
            />
          </div>
        )}
        {FONT_SIZE_PRESETS.map((size) => (
          <button
            key={size}
            onClick={() => { applySize(size); closeDropdown(); }}
            className={cn(
              "w-full text-center px-2 py-1 text-xs transition-colors hover:bg-panel-hover",
              currentSize === size && "text-primary bg-panel"
            )}
          >
            {size}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
