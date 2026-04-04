// Self-contained link insert/edit popover that manages its own open state.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import { Link2, Unlink } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";

export function LinkPopover({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [linkPopover, setLinkPopover] = useState<{ visible: boolean; url: string }>({ visible: false, url: "" });
  const [linkLeft, setLinkLeft] = useState(0);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!linkPopover.visible) return;
    const handle = (e: MouseEvent) => {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
        setLinkPopover({ visible: false, url: "" });
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [linkPopover.visible]);

  // Clamp link popover so it stays within the viewport with 8px padding on all edges
  useLayoutEffect(() => {
    if (!linkPopover.visible) { setLinkLeft(0); return; }
    const popover = linkPopoverRef.current;
    if (!popover) return;
    const pad = 8;
    const rect = popover.getBoundingClientRect();
    const vw = window.innerWidth;
    const rightOverflow = rect.right - (vw - pad);
    const leftUnderflow = pad - rect.left;
    if (rightOverflow > 0) setLinkLeft(-rightOverflow);
    else if (leftUnderflow > 0) setLinkLeft(leftUnderflow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkPopover.visible]);

  if (!editor) return null;

  const openLinkPopover = () => {
    const existing = editor.getAttributes("link").href as string | undefined;
    setLinkPopover({ visible: true, url: existing ?? "" });
    setTimeout(() => linkInputRef.current?.focus(), 30);
  };

  const applyLink = () => {
    const trimmed = linkPopover.url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkPopover({ visible: false, url: "" });
  };

  return (
    <div className="relative shrink-0">
      <ToolbarButton
        command={openLinkPopover}
        active={editor.isActive("link")}
        icon={<Link2 className="w-4 h-4" />}
        title="Insert / edit link (Ctrl+K)"
      />
      {linkPopover.visible && (
        <div
          ref={linkPopoverRef}
          className="absolute top-full mt-1.5 z-30 flex items-center gap-1.5 bg-popover border border-panel-border rounded-xl shadow-xl px-3 py-2 min-w-[280px]"
          style={{ left: linkLeft }}
        >
          <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            ref={linkInputRef}
            type="text"
            placeholder="https://example.com"
            value={linkPopover.url}
            onChange={(e) => setLinkPopover((p) => ({ ...p, url: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); applyLink(); }
              if (e.key === "Escape") setLinkPopover({ visible: false, url: "" });
              e.stopPropagation();
            }}
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/60 min-w-0"
          />
          {editor.isActive("link") && (
            <button
              onClick={() => { editor.chain().focus().unsetLink().run(); setLinkPopover({ visible: false, url: "" }); }}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove link"
            >
              <Unlink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={applyLink}
            className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
