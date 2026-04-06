// Full editor formatting toolbar with font, color, link, and block controls.

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListTodo, Quote, Code, Heading1, Heading2, Heading3,
  Image as ImageIcon, Table as TableIcon, RowsIcon, Scissors, X,
  Undo2, Redo2, Minus, Highlighter, Paperclip,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
} from "lucide-react";
import { ColorPickerDropdown } from "./ColorPickerDropdown";
import { WordCountPopover } from "./WordCountPopover";
import { ToolbarButton } from "./ToolbarButton";
import { ScrollableToolbar } from "./ScrollableToolbar";
import { FontPickerDropdown } from "./FontPickerDropdown";
import { FontSizeWidget } from "./FontSizeWidget";
import { LinkPopover } from "./LinkPopover";
import { createPortal } from "react-dom";

// Inline image-URL popover — no window.prompt
function ImageUrlButton({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const w = 260;
    let left = r.left;
    if (left + w > vw - pad) left = vw - w - pad;
    setStyle({ position: "fixed", top: r.bottom + 6, left, zIndex: 50, width: w });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false); setUrl("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const commit = () => {
    const trimmed = url.trim();
    if (trimmed) editor?.chain().focus().setImage({ src: trimmed }).run();
    setOpen(false); setUrl("");
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => { setOpen(v => !v); setUrl(""); }}
        title="Insert image from URL"
        className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex items-center justify-center${open ? " bg-panel text-primary" : ""}`}
      >
        <ImageIcon className="w-4 h-4" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={style}
          className="bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-2 flex flex-col gap-2"
          onMouseDown={e => e.preventDefault()}
        >
          <p className="text-xs text-muted-foreground px-1">Image URL</p>
          <input
            autoFocus
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setOpen(false); setUrl(""); } }}
            placeholder="https://…"
            className="bg-transparent border border-panel-border rounded px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <div className="flex gap-1.5">
            <button
              onClick={commit}
              disabled={!url.trim()}
              className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Insert
            </button>
            <button
              onClick={() => { setOpen(false); setUrl(""); }}
              className="px-3 py-1.5 rounded-lg border border-panel-border text-xs text-muted-foreground hover:bg-panel transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Fix 5: memo prevents re-renders when NoteEditor state changes but editor/toolbar props are stable
export const EditorToolbar = memo(function EditorToolbar({
  editor,
  showUndoRedo,
  className,
  style,
  onAttachFile,
}: {
  editor: ReturnType<typeof useEditor>;
  showUndoRedo?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onAttachFile?: (file: File) => void;
}) {
  const [colorPicker, setColorPicker] = useState<"text" | "highlight" | null>(null);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const textColorBtnRef = useRef<HTMLButtonElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const fontPickerBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const activeTextColor: string | undefined = editor.getAttributes("textStyle").color;
  const activeHighlightColor: string | undefined = editor.getAttributes("highlight").color;

  return (
    <ScrollableToolbar className={className} style={style}>
      {showUndoRedo && (
        <>
          <ToolbarButton
            command={() => editor.chain().focus().undo().run()}
            active={false}
            disabled={!editor.can().undo()}
            icon={<Undo2 className="w-4 h-4" />}
            title="Undo (Ctrl+Z)"
          />
          <ToolbarButton
            command={() => editor.chain().focus().redo().run()}
            active={false}
            disabled={!editor.can().redo()}
            icon={<Redo2 className="w-4 h-4" />}
            title="Redo (Ctrl+Shift+Z)"
          />
          <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />
        </>
      )}

      <ToolbarButton command={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} icon={<Bold className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} icon={<Italic className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} icon={<UnderlineIcon className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} icon={<Strikethrough className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} icon={<SuperscriptIcon className="w-4 h-4" />} title="Superscript" />
      <ToolbarButton command={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} icon={<SubscriptIcon className="w-4 h-4" />} title="Subscript" />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      {/* Font family picker */}
      <div className="relative shrink-0">
        <button
          ref={fontPickerBtnRef}
          onClick={() => setFontPickerOpen((v) => !v)}
          title="Font family"
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 md:px-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex items-center justify-center text-sm font-medium${fontPickerOpen ? " bg-panel text-primary" : ""}`}
        >
          Aa
        </button>
        {fontPickerOpen && (
          <FontPickerDropdown
            editor={editor}
            onClose={() => setFontPickerOpen(false)}
            triggerRef={fontPickerBtnRef}
          />
        )}
      </div>

      <FontSizeWidget editor={editor} />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      {/* Text color picker */}
      <div className="relative shrink-0">
        <button
          ref={textColorBtnRef}
          onClick={() => setColorPicker(colorPicker === "text" ? null : "text")}
          title="Text color"
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 md:px-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex flex-col items-center justify-center gap-0.5 py-1${colorPicker === "text" ? " bg-panel text-primary" : ""}`}
        >
          <span className="text-sm font-bold leading-none">A</span>
          <div
            className="w-4 h-[3px] rounded-sm"
            style={{ backgroundColor: activeTextColor ?? "currentColor" }}
          />
        </button>
        {colorPicker === "text" && (
          <ColorPickerDropdown type="text" editor={editor} onClose={() => setColorPicker(null)} triggerRef={textColorBtnRef} />
        )}
      </div>

      {/* Highlight color picker */}
      <div className="relative shrink-0">
        <button
          ref={highlightBtnRef}
          onClick={() => setColorPicker(colorPicker === "highlight" ? null : "highlight")}
          title="Highlight color"
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex items-center justify-center${colorPicker === "highlight" ? " bg-panel text-primary" : ""}${activeHighlightColor ? " text-foreground" : ""}`}
          style={activeHighlightColor ? { color: activeHighlightColor } : undefined}
        >
          <Highlighter className="w-4 h-4" />
        </button>
        {colorPicker === "highlight" && (
          <ColorPickerDropdown type="highlight" editor={editor} onClose={() => setColorPicker(null)} triggerRef={highlightBtnRef} />
        )}
      </div>

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <ToolbarButton command={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} icon={<Heading1 className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} icon={<Heading2 className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} icon={<Heading3 className="w-4 h-4" />} />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <ToolbarButton command={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} icon={<AlignLeft className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} icon={<AlignCenter className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} icon={<AlignRight className="w-4 h-4" />} />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <ToolbarButton command={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} icon={<List className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} icon={<ListOrdered className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} icon={<ListTodo className="w-4 h-4" />} title="Checklist" />
      <ToolbarButton command={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} icon={<Quote className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} icon={<Code className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().setHorizontalRule().run()} active={false} icon={<Minus className="w-4 h-4" />} title="Horizontal divider" />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <ToolbarButton
        command={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        active={false}
        icon={<TableIcon className="w-4 h-4" />}
        title="Insert table"
      />
      {editor.isActive("table") && (
        <>
          <ToolbarButton command={() => editor.chain().focus().addRowAfter().run()} active={false} icon={<RowsIcon className="w-4 h-4" />} title="Add row" />
          <ToolbarButton command={() => editor.chain().focus().deleteRow().run()} active={false} icon={<Scissors className="w-4 h-4" />} title="Delete row" />
          <ToolbarButton command={() => editor.chain().focus().deleteTable().run()} active={false} icon={<X className="w-4 h-4" />} title="Delete table" />
        </>
      )}

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <ImageUrlButton editor={editor} />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <LinkPopover editor={editor} />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <WordCountPopover editor={editor} />

      {onAttachFile && (
        <>
          <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,text/markdown,application/json,application/zip"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { onAttachFile(file); e.target.value = ""; }
            }}
          />
          <ToolbarButton
            command={() => fileInputRef.current?.click()}
            active={false}
            icon={<Paperclip className="w-4 h-4" />}
            title="Attach file"
          />
        </>
      )}
    </ScrollableToolbar>
  );
});
