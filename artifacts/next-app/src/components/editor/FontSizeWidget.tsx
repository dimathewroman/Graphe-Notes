// Font size control with inline edit, hover dropdown, and mobile input support.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { useEditor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/use-mobile";
import { FONT_SIZE_PRESETS, DEFAULT_FONT_SIZE } from "./ai-action-groups";

export function FontSizeWidget({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  const valueRef = useRef<HTMLButtonElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!editor) return null;

  const rawSize = editor.getAttributes("textStyle").fontSize as string | undefined;
  const currentSize = rawSize ? parseInt(rawSize, 10) : DEFAULT_FONT_SIZE;

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

  useLayoutEffect(() => {
    if (!dropdownOpen) return;
    const trigger = valueRef.current;
    const menu = dropdownRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const menuW = menu.offsetWidth || 80;
    const menuH = menu.offsetHeight || 200;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 4;
    let left = rect.left + rect.width / 2 - menuW / 2;
    if (left + menuW > vw - pad) left = vw - pad - menuW;
    if (left < pad) left = pad;
    if (top + menuH > vh - pad) top = rect.top - menuH - 4;
    if (top < pad) top = pad;
    setPos({ top, left });
  }, [dropdownOpen]);

  useEffect(() => {
    if (editing) inlineInputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        valueRef.current && !valueRef.current.contains(t) &&
        dropdownRef.current && !dropdownRef.current.contains(t)
      ) closeDropdown();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") closeDropdown(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [dropdownOpen]);

  return (
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
      )}

      <div className="w-px h-3.5 bg-panel-border" />

      <button
        onClick={() => nudge(1)}
        className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:w-5 md:h-6 flex items-center justify-center text-muted-foreground hover:bg-panel hover:text-foreground transition-colors text-sm px-1"
        title="Increase font size"
      >
        +
      </button>

      {dropdownOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-popover border border-panel-border rounded-xl shadow-2xl py-1.5 w-20 max-h-64 overflow-y-auto"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
          onMouseLeave={handleHoverLeave}
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
        </div>,
        document.body
      )}
    </div>
  );
}
