// Full editor formatting toolbar with font, color, link, and block controls.

import { memo, useLayoutEffect, useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListTodo, Quote, Code, Heading1, Heading2, Heading3,
  Image as ImageIcon, Table as TableIcon, RowsIcon, Scissors, X,
  Undo2, Redo2, Minus, Highlighter,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
} from "lucide-react";
import { ColorPickerDropdown } from "./ColorPickerDropdown";
import { WordCountPopover } from "./WordCountPopover";
import { ToolbarButton } from "./ToolbarButton";
import { ScrollableToolbar } from "./ScrollableToolbar";
import { FontPickerDropdown } from "./FontPickerDropdown";
import { FontSizeWidget } from "./FontSizeWidget";
import { LinkPopover } from "./LinkPopover";

// Fix 5: memo prevents re-renders when NoteEditor state changes but editor/toolbar props are stable
export const EditorToolbar = memo(function EditorToolbar({
  editor,
  showUndoRedo,
  className,
  style,
}: {
  editor: ReturnType<typeof useEditor>;
  showUndoRedo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [colorPicker, setColorPicker] = useState<"text" | "highlight" | null>(null);
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const textColorBtnRef = useRef<HTMLButtonElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);
  const fontPickerBtnRef = useRef<HTMLButtonElement>(null);

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
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 md:px-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex items-center justify-center text-sm font-medium${fontPickerOpen ? " bg-panel text-primary" : ""}`}
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
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 md:px-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex flex-col items-center justify-center gap-0.5 py-1${colorPicker === "text" ? " bg-panel text-primary" : ""}`}
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
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex items-center justify-center${colorPicker === "highlight" ? " bg-panel text-primary" : ""}${activeHighlightColor ? " text-foreground" : ""}`}
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

      <ToolbarButton
        command={() => {
          const url = window.prompt("Image URL");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
        active={false}
        icon={<ImageIcon className="w-4 h-4" />}
        title="Insert image"
      />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <LinkPopover editor={editor} />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <WordCountPopover editor={editor} />
    </ScrollableToolbar>
  );
});
