// GrapheEditor — the single unified TipTap editor used by both NoteShell and QuickBitShell.
// This component owns the useEditor() setup, the toolbar, AI menus, slash command menu,
// find/replace panel, and clipboard paste handling. It knows nothing about save logic,
// note metadata, folders, tags, timers, or navigation.

import { useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { useEditor } from "@tiptap/react";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { CustomImage } from "./CustomImageExtension";
import { ImageUploadExtension } from "./ImageUploadExtension";
import FileHandler from "@tiptap/extension-file-handler";
import { Selection } from "@tiptap/extensions";
import UniqueID from "@tiptap/extension-unique-id";
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
import Emoji from "@tiptap/extension-emoji";
import { InlineMath, BlockMath } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";

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
import { toast } from "sonner";

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
  onAttachFile?: (file: File) => Promise<{ url?: string; id?: string; masterPath?: string | null; fileType?: string; downloadUrl?: string; isAnimated?: boolean } | null | undefined>;
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

/** Find and return position of an imageUpload node by its UUID id attribute. */
function findUploadNode(editor: Editor, uploadId: string): { pos: number; nodeSize: number } | null {
  let result: { pos: number; nodeSize: number } | null = null;
  editor.view.state.doc.descendants((node, pos): boolean | void => {
    if (result) return false;
    if (node.type.name === "imageUpload" && node.attrs.id === uploadId) {
      result = { pos, nodeSize: node.nodeSize };
      return false;
    }
  });
  return result;
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

  // Toolbar bottom position — debounced via setTimeout to avoid the resize→scroll race.
  // Chrome fires vv.resize (height changes) and vv.scroll (offsetTop/pan changes) as two
  // separate browser tasks with a paint possible in between. requestAnimationFrame fires
  // between these tasks, so it still reads a stale vv.offsetTop on the first render and
  // the toolbar flashes at the wrong height. setTimeout(fn, 30) queues a macrotask that
  // runs after both events have settled (~2 frames): both vv.height and vv.offsetTop are
  // stable by then, so the toolbar renders exactly once at the correct position.
  const [toolbarBottom, setToolbarBottom] = useState(0);
  useEffect(() => {
    if (bp !== "mobile") return;
    const vv = window.visualViewport;
    if (!vv) return;
    let timerId = 0;
    const update = () => {
      clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        const inset = window.innerHeight - vv.height;
        const kbH = inset > 50 ? inset : 0;
        setToolbarBottom(kbH > 0 ? Math.max(0, kbH - vv.offsetTop) : 0);
      }, 30);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timerId);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [bp]);

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
    // ImageUploadExtension — atom placeholder during upload; no blob: URLs enter the document
    ImageUploadExtension,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Link.configure({
      openOnClick: false,
      enableClickSelection: true,
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
    Emoji,
    InlineMath,
    BlockMath,
    // FileHandler replaces the manual paste listener; configured below via ref to avoid
    // stale closure (editorExtensions has [] deps but handleAttachFile is a useCallback).
    FileHandler.configure({
      allowedMimeTypes: Array.from(IMAGE_MIME_TYPES),
      onPaste(_editor: Editor, files: File[]) {
        files.forEach(file => { handleAttachFileRef.current?.(file); });
      },
      onDrop(_editor: Editor, files: File[]) {
        files.forEach(file => { handleAttachFileRef.current?.(file); });
      },
    }),
    // Selection: replaces browser's default ::selection with a themeable decoration
    // so brand-color text selection works consistently cross-browser and in dark modes.
    Selection,
    // UniqueID: adds data-id (uuid) to each block node — required for Yjs stable IDs,
    // block deep links, and future comment anchoring. Yjs-aware (skips y-sync$ txns).
    UniqueID.configure({
      types: [
        "paragraph", "heading", "bulletList", "orderedList",
        "taskList", "blockquote", "codeBlock", "details",
      ],
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: editorExtensions,
    // Content intentionally omitted — TipTap v3 calls setOptions() on every render when
    // content changes, firing onUpdate (accidental save) and potentially recreating the editor.
    // Content is set imperatively via editor.commands.setContent() in the useEffect below.
    content: "",
    editable,
    onUpdate: ({ editor }) => {
      // imageUpload nodes have no src — they render as <div data-type="imageUpload">
      // and are excluded from getHTML() output automatically (atom nodes render their
      // renderHTML() output, not their NodeView). No blob: stripping needed.
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
        autocapitalize: "off",
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
  const prevContentKeyRef = useRef<string | number | undefined>(undefined);
  useEffect(() => {
    if (!editor) return;
    // V1: skip the transient `undefined` contentKey while React Query loads — it
    // would set an empty doc (and, before this fix, added an extra undoable
    // empty-doc step). We only (re)load content once a real item is selected.
    if (contentKey === undefined) return;
    // Track whether this is a switch (not the initial load) so we can mask the
    // one-frame blank that appears between contentKey changing and setContent firing.
    const isSwitch = prevContentKeyRef.current !== undefined && prevContentKeyRef.current !== contentKey;
    prevContentKeyRef.current = contentKey;
    // Defer outside React's commit phase — TipTap's ReactNodeViewRenderer calls
    // flushSync when editor.isInitialized, which React 19 forbids inside lifecycle methods.
    setTimeout(() => {
      if (!editor.isDestroyed) {
        const dom = editor.view.dom as HTMLElement;
        if (isSwitch) {
          // Hide instantly before setting content so the one-frame blank is invisible.
          dom.style.opacity = "0";
          dom.style.transition = "none";
        }
        editor.commands.setContent(content, { emitUpdate: false });
        // V1 fix: clear the undo/redo history on every content (re)load so the
        // note swap itself is not an undoable step, and note A's edits can never
        // be undone into note B's document (which previously blanked/corrupted
        // note B and autosaved the result). One ProseMirror history stack is
        // shared for the editor's lifetime; re-creating the EditorState with the
        // same plugins re-initialises the history plugin with empty stacks while
        // preserving the freshly-set doc.
        const view = editor.view;
        view.updateState(
          EditorState.create({
            doc: view.state.doc,
            schema: view.state.schema,
            plugins: view.state.plugins,
          }),
        );
        if (isSwitch) {
          // Next frame: fade the new content in once the DOM has been updated.
          requestAnimationFrame(() => {
            dom.style.transition = "opacity 80ms ease";
            dom.style.opacity = "1";
          });
        }
      }
    }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, editor]);

  // AI actions
  const { callAI, aiLoading, aiError, captureSelection } = useAiAction(editor, {
    isDemo,
    onBeforeAiRewrite,
  });

  // Attach-file: inserts an imageUpload atom node immediately (no blob: URL), then
  // replaces it with a real image node once the upload round-trip completes.
  // FileHandler extension (in editorExtensions) calls this for both paste and drop,
  // replacing the former manual document.addEventListener("paste", ...) useEffect.
  const handleAttachFile = useCallback(async (file: File) => {
    if (!onAttachFile || !editor) return;

    const uploadId = crypto.randomUUID();

    // Insert placeholder atom node — no src, Yjs-serializable
    editor.chain().focus().insertContent({
      type: "imageUpload",
      attrs: { id: uploadId, fileName: file.name },
    }).run();

    let result: { url?: string; id?: string; masterPath?: string | null; downloadUrl?: string; isAnimated?: boolean } | null | undefined;
    try {
      result = await onAttachFile(file);
    } catch {
      result = null;
    }

    if (editor.isDestroyed) return;
    const found = findUploadNode(editor, uploadId);
    if (!found) return; // user deleted the placeholder while upload was in flight

    const { state } = editor.view;
    if (!result?.url) {
      editor.view.dispatch(state.tr.delete(found.pos, found.pos + found.nodeSize));
      toast.error("Couldn't upload that image. Check your connection and try again.");
      return;
    }

    const imageNode = editor.schema.nodes.image!.create({
      src: result.url,
      alt: file.name,
      ...(result.id ? { attachmentId: result.id } : {}),
      ...(result.masterPath ? { masterPath: result.masterPath } : {}),
      ...(result.downloadUrl ? { downloadUrl: result.downloadUrl } : {}),
      ...(result.isAnimated ? { isAnimated: true } : {}),
    });
    const insertTr = state.tr.replaceWith(found.pos, found.pos + found.nodeSize, imageNode);
    // Move cursor just past the image so the node deselects — the ring won't linger
    // after a drag/paste drop and the user can keep typing immediately.
    try {
      const $after = insertTr.doc.resolve(found.pos + imageNode.nodeSize);
      insertTr.setSelection(TextSelection.near($after));
    } catch {
      // no text position nearby — leave default selection
    }
    editor.view.dispatch(insertTr);
  }, [onAttachFile, editor]);

  // Keep a stable ref so FileHandler (which is configured in the [] useMemo) can
  // always call the latest handleAttachFile without capturing a stale closure.
  const handleAttachFileRef = useRef(handleAttachFile);
  useEffect(() => { handleAttachFileRef.current = handleAttachFile; }, [handleAttachFile]);

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

  // Mobile: keep the cursor above the fixed bottom toolbar.
  // The browser's built-in scroll-into-view doesn't know about our toolbar, so
  // after every selection change or document update we check whether the cursor
  // is hidden behind the toolbar+keyboard and manually scroll the editor's own
  // scroll container to expose it.  `keyboardHeight` is read via a ref so the
  // effect doesn't re-subscribe on every keyboard animation frame.
  const keyboardHeightRef = useRef(keyboardHeight);
  keyboardHeightRef.current = keyboardHeight;

  useEffect(() => {
    if (bp !== "mobile" || !editor) return;

    // Approximate height of the fixed mobile formatting toolbar (ScrollableToolbar).
    // The toolbar uses min-h-[44px] buttons inside a scrollable strip — 56px is safe.
    const TOOLBAR_HEIGHT = 56;

    const ensureCursorVisible = () => {
      // Defer one frame so ProseMirror's own DOM updates have settled
      requestAnimationFrame(() => {
        const { from } = editor.state.selection;
        let coords: { top: number; bottom: number };
        try {
          coords = editor.view.coordsAtPos(from);
        } catch {
          return; // editor may have been destroyed
        }

        // The lowest pixel the user can actually see (above toolbar + keyboard + buffer)
        const visibleBottom =
          window.innerHeight - (keyboardHeightRef.current || 0) - TOOLBAR_HEIGHT - 16;

        if (coords.bottom > visibleBottom) {
          // Walk up the DOM from the ProseMirror root to find the scroll container
          let el: HTMLElement | null = editor.view.dom as HTMLElement;
          while (el && el !== document.body) {
            const style = window.getComputedStyle(el);
            if (style.overflowY === "auto" || style.overflowY === "scroll") {
              el.scrollBy({ top: coords.bottom - visibleBottom, behavior: "instant" });
              break;
            }
            el = el.parentElement;
          }
        }
      });
    };

    editor.on("selectionUpdate", ensureCursorVisible);
    editor.on("update", ensureCursorVisible);
    return () => {
      editor.off("selectionUpdate", ensureCursorVisible);
      editor.off("update", ensureCursorVisible);
    };
  }, [bp, editor]); // keyboardHeight read via ref — no re-subscribe on each animation frame

  // Mobile/touch: suppress the OS native context menu inside the editor so the
  // app's MobileSelectionMenu is the only floating toolbar. Desktop right-click
  // still gets the native menu (preserving copy/paste/inspect-element).
  useEffect(() => {
    if (bp !== "mobile" || !editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onContext = (e: Event) => e.preventDefault();
    dom.addEventListener("contextmenu", onContext);
    return () => dom.removeEventListener("contextmenu", onContext);
  }, [bp, editor]);

  // Mobile (Android): when the soft keyboard is dismissed via the system back
  // gesture, the contenteditable keeps DOM focus and the caret keeps blinking
  // even though the keyboard is gone. Detect the keyboard-close transition and
  // explicitly blur the active editable so the caret disappears with it.
  const prevKeyboardOpenRef = useRef(false);
  useEffect(() => {
    if (bp !== "mobile") return;
    const isOpen = keyboardHeight > 0;
    if (prevKeyboardOpenRef.current && !isOpen) {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.isContentEditable ||
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA")
      ) {
        active.blur();
      }
    }
    prevKeyboardOpenRef.current = isOpen;
  }, [bp, keyboardHeight]);

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

      {/* Mobile bottom toolbar — keyboard-aware. showUndoRedo lives here (not in the top
          bar) so the user can undo/redo without dismissing the keyboard.
          Rendered via createPortal into document.body so position:fixed is relative to the
          viewport, not a transformed motion.div ancestor (Framer Motion keeps transform:
          translateX(0) active on animated divs, breaking fixed positioning for descendants).
          toolbarBottom accounts for vv.offsetTop: when Chrome pans the visual viewport
          downward to keep the cursor in view after the keyboard opens, we subtract that
          offset so the toolbar tracks the visual viewport bottom (= keyboard top). */}
      {bp === "mobile" && typeof document !== "undefined" && createPortal(
        <EditorToolbar
          editor={editor}
          showUndoRedo
          className="fixed left-0 right-0 z-40 border-t border-panel-border bg-editor/95 backdrop-blur-md"
          style={{ bottom: toolbarBottom }}
          onAttachFile={attachFileHandler}
        />,
        document.body
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
