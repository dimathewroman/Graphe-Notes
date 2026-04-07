// GrapheEditor — the single unified TipTap editor used by both NoteShell and QuickBitShell.
// This component owns the useEditor() setup, the toolbar, AI menus, slash command menu,
// find/replace panel, and clipboard paste handling. It knows nothing about save logic,
// note metadata, folders, tags, timers, or navigation.

import { useEffect, useCallback, useMemo, useState, type ReactNode } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { CustomImage } from "./CustomImageExtension";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableHeader, TableCell } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import SuperscriptExt from "@tiptap/extension-superscript";
import SubscriptExt from "@tiptap/extension-subscript";
import Typography from "@tiptap/extension-typography";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";

const lowlight = createLowlight(common);

import { SlashCommandExtension, SlashCommandMenu } from "./SlashCommandMenu";
import { FindReplaceExtension, FindReplacePanel, frClear } from "./FindReplace";
import { VideoEmbedExtension } from "./VideoEmbed";
import { SmartTaskItem } from "./SmartTaskItem";
import { SwipeIndentExtension } from "./SwipeIndentExtension";
import { ListExitOnEnterExtension } from "./ListExitOnEnterExtension";
import { EditorToolbar } from "./EditorToolbar";
import { AiSelectionMenu } from "./AiSelectionMenu";
import { MobileSelectionMenu } from "./MobileSelectionMenu";
import { AiStatusIndicator } from "./AiStatusIndicator";
import { useAiAction } from "@/hooks/use-ai-action";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { IMAGE_MIME_TYPES } from "@/lib/attachment-limits";
import { isImageType } from "@/hooks/use-attachments";

export interface GrapheEditorProps {
  /** HTML string to display. Set imperatively when contentKey changes. */
  content: string;
  /**
   * When this value changes GrapheEditor resets the editor content to `content`.
   * Pass note.id or quickBit.id so switching items reloads content correctly.
   */
  contentKey?: string | number;
  onContentChange: (html: string, text: string) => void;
  placeholder?: string;
  mode: "note" | "quickbit";
  editable?: boolean;
  isDemo?: boolean;
  /**
   * Called when the user attaches a file via the toolbar or clipboard paste.
   * The shell handles the upload and returns the resulting URL (if any).
   * GrapheEditor inserts the image into the editor if the file is an image type.
   */
  onAttachFile?: (file: File) => Promise<{ url?: string } | undefined>;
  /**
   * Called once the TipTap editor instance is ready (or null when destroyed).
   * Shells that need the editor ref (e.g. for undo/redo in the header on mobile)
   * can store it in local state via this callback.
   */
  onEditorReady?: (editor: Editor | null) => void;
  /**
   * Called immediately before any AI rewrite. NoteShell uses this to take a
   * pre_ai_rewrite version snapshot so the user can always undo a model edit.
   * Quick bits don't have versions and pass nothing.
   */
  onBeforeAiRewrite?: () => Promise<void> | void;
  /**
   * Render prop for the scrollable content area inside the editor chrome.
   * The shell is responsible for rendering its title input, tag rows, EditorContent, etc.
   */
  renderContent: (editor: Editor) => ReactNode;
}

export function GrapheEditor({
  content,
  contentKey,
  onContentChange,
  placeholder = "Start writing...",
  editable = true,
  isDemo = false,
  onAttachFile,
  onEditorReady,
  onBeforeAiRewrite,
  renderContent,
}: GrapheEditorProps) {
  const bp = useBreakpoint();
  const keyboardHeight = useKeyboardHeight();
  const [showFindReplace, setShowFindReplace] = useState(false);

  // Fix 1: stable extensions reference — useMemo([]) ensures the same array instance is
  // reused for the lifetime of the component, preventing TipTap from re-calling setOptions()
  // on every render (which would fire onUpdate and trigger accidental saves).
  const editorExtensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: false, codeBlock: false }),
    UnderlineExt,
    TextStyle,
    FontSize,
    Color,
    FontFamily,
    // CustomImage (NOT bare Image) — React NodeView with selection UI, alt-text, source badges
    CustomImage,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
    }),
    TaskList,
    // SmartTaskItem (NOT bare TaskItem) — auto-sort checked items, parent-uncheck cascading
    SmartTaskItem.configure({ nested: true }),
    SlashCommandExtension,
    SuperscriptExt,
    SubscriptExt,
    FindReplaceExtension,
    VideoEmbedExtension,
    SwipeIndentExtension,
    ListExitOnEnterExtension,
    Typography,
    CodeBlockLowlight.configure({ lowlight }),
    Details,
    DetailsContent,
    DetailsSummary,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    // Content intentionally omitted — TipTap v3 calls setOptions() on every render when
    // content changes, firing onUpdate (accidental save) and potentially recreating the editor.
    // Content is set imperatively via editor.commands.setContent() in the useEffect below.
    content: "",
    editable,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none",
        // Suppress iPadOS / iOS Safari's password-autofill bar above the soft keyboard.
        // Without this, focusing the contenteditable inside a task list (which contains
        // <input type="checkbox"> nodes) makes iOS treat it like a form field and pop up
        // the AutoFill toolbar.
        autocomplete: "off",
        autocorrect: "off",
        spellcheck: "true",
      },
    },
  });

  // Notify shell when editor becomes available or is destroyed
  useEffect(() => {
    onEditorReady?.(editor ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Reset editor content when the active item changes (note switch / QB switch).
  // contentKey must be note.id or quickBit.id — changes when the user selects a different item.
  // content is intentionally NOT in deps: the editor is the source of truth while the user is
  // typing; we only override it when switching to a different item.
  useEffect(() => {
    if (!editor) return;
    // Defer outside React's commit phase — TipTap's ReactNodeViewRenderer calls
    // flushSync when editor.isInitialized, which React 19 forbids inside lifecycle methods.
    setTimeout(() => {
      if (!editor.isDestroyed) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, editor]);

  // AI actions
  const { callAI, aiLoading, aiError, captureSelection } = useAiAction(editor, {
    isDemo,
    onBeforeAiRewrite,
  });

  // Attach-file wrapper: shell uploads → GrapheEditor inserts image into the editor
  const handleAttachFile = useCallback(async (file: File) => {
    if (!onAttachFile) return;
    const result = await onAttachFile(file);
    if (result?.url && isImageType(file.type)) {
      editor?.chain().focus().setImage({ src: result.url, alt: file.name }).run();
    }
  }, [onAttachFile, editor]);

  // Clipboard paste: intercept image blobs and upload them
  useEffect(() => {
    if (!onAttachFile) return;
    const onPaste = async (e: ClipboardEvent) => {
      if (!editor?.isFocused) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(item => IMAGE_MIME_TYPES.has(item.type));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      const result = await onAttachFile(file);
      if (result?.url) {
        editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [editor, onAttachFile]);

  // Find/replace keyboard shortcut — only intercept when editor has focus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editor?.isFocused) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "f" || key === "h") {
        e.preventDefault();
        setShowFindReplace(true);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [editor]);

  // Render nothing until editor is ready
  if (!editor) return null;

  const attachFileHandler = onAttachFile ? handleAttachFile : undefined;

  return (
    <>
      {/* Desktop/tablet toolbar — sits below the shell's header */}
      {bp !== "mobile" && (
        <EditorToolbar
          editor={editor}
          showUndoRedo
          onAttachFile={attachFileHandler}
        />
      )}

      {/* Text selection AI menus */}
      {bp === "mobile" ? (
        <MobileSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={captureSelection}
        />
      ) : (
        <AiSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={captureSelection}
        />
      )}

      <AiStatusIndicator aiLoading={aiLoading} aiError={aiError} />

      {/* Content area — injected by shell (scrollable region with title, tags, EditorContent) */}
      {renderContent(editor)}

      {/* Slash command floating menu */}
      <SlashCommandMenu editor={editor} />

      {/* Mobile bottom toolbar — keyboard-aware */}
      {bp === "mobile" && (
        <EditorToolbar
          editor={editor}
          className="fixed left-0 right-0 z-40 border-t border-panel-border bg-editor/95 backdrop-blur-md"
          style={{ bottom: keyboardHeight > 0 ? keyboardHeight : 0 }}
          onAttachFile={attachFileHandler}
        />
      )}

      {/* Find/replace panel */}
      {showFindReplace && (
        <FindReplacePanel
          editor={editor}
          onClose={() => {
            setShowFindReplace(false);
            frClear(editor);
          }}
        />
      )}
    </>
  );
}
