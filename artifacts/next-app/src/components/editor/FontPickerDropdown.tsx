// Portaled font family picker dropdown for the editor toolbar.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { useEditor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { FONTS } from "./ai-action-groups";

export function FontPickerDropdown({
  editor,
  onClose,
  triggerRef,
}: {
  editor: ReturnType<typeof useEditor>;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const menu = containerRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuW = menu.offsetWidth || 200;
    const menuH = menu.offsetHeight || 280;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = triggerRect.bottom + 6;
    let left = triggerRect.left;
    if (left + menuW > vw - pad) left = vw - pad - menuW;
    if (left < pad) left = pad;
    if (top + menuH > vh - pad) top = triggerRect.top - menuH - 6;
    if (top < pad) top = pad;
    setPos({ top, left });
  }, [triggerRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  if (!editor) return null;

  const activeFont = editor.getAttributes("textStyle").fontFamily as string | undefined;

  const applyFont = (value: string | null) => {
    if (value === null) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(value).run();
    }
    onClose();
  };

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-50 bg-popover border border-panel-border rounded-xl shadow-2xl py-1.5 w-48"
      style={{ top: pos.top, left: pos.left }}
    >
      {FONTS.map((font) => {
        const isActive = font.value === null
          ? !activeFont
          : activeFont === font.value || activeFont === font.family;
        return (
          <button
            key={font.label}
            onClick={() => applyFont(font.value)}
            className={cn(
              "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-panel-hover",
              isActive && "text-primary bg-panel"
            )}
            style={{ fontFamily: font.family }}
          >
            {font.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
