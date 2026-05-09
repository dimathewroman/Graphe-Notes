// GrapheEditor — the single unified TipTap editor used by both NoteShell and QuickBitShell.
// This component owns the useEditor() setup, the toolbar, AI menus, slash command menu,
// find/replace panel, and clipboard paste handling. It knows nothing about save logic,
// note metadata, folders, tags, timers, or navigation.

import { useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useEditor } from "@tiptap/react";
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
import { IMAGE_MIME_TYPES, BROWSER_RENDERABLE_IMAGE_TYPES } from "@/lib/attachment-limits";

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

type UploadResult = {
  url: string;
  id?: string;
  masterPath?: string | null;
  downloadUrl?: string;
  isAnimated?: boolean;
};

/** True if any part of the element is within the visible viewport. */
function isElementInViewport(el: Element): boolean {
  const { top, bottom, left, right } = el.getBoundingClientRect();
  return bottom > 0 && top < window.innerHeight && right > 0 && left < window.innerWidth;
}

/**
 * Create a blob: URL containing an SVG "uploading…" placeholder.
 * Used for HEIC and other types the browser can't render from raw bytes.
 * Returns a blob: URL so the onContentChange blob-strip regex handles it automatically.
 */
function makeUploadPlaceholder(fileName: string): string {
  const safe = fileName.replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c)
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
    <rect width="320" height="180" rx="8" fill="#111113"/>
    <rect x="1" y="1" width="318" height="178" rx="7.5" fill="none" stroke="#27272a" stroke-width="1"/>
    <text x="160" y="76" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" fill="#52525b">⬆</text>
    <text x="160" y="104" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="#a1a1aa">Uploading image…</text>
    <text x="160" y="124" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#52525b">${safe}</text>
  </svg>`;
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

/** Find an image node by its current src. Re-queries the live document state. */
function findImageNode(editor: Editor, src: string): { pos: number; nodeSize: number; attrs: Record<string, unknown> } | null {
  let result: { pos: number; nodeSize: number; attrs: Record<string, unknown> } | null = null;
  editor.view.state.doc.descendants((node, pos): boolean | void => {
    if (result) return false;
    if (node.type.name === "image" && node.attrs.src === src) {
      result = { pos, nodeSize: node.nodeSize, attrs: node.attrs as Record<string, unknown> };
      return false;
    }
  });
  return result;
}

/**
 * Find an image node by its placeholder src and either swap it to the permanent
 * signed URL (result ≠ null) or delete it entirely (result === null, upload failed).
 *
 * Swap strategy: if the image is currently visible, preload the new URL silently
 * and swap only once it's in the browser's cache — the user never sees a loading
 * state because both the old and new images render from memory. If the image is
 * off-screen, swap immediately.
 */
function swapImageNode(editor: Editor, placeholderSrc: string, result: UploadResult | null) {
  if (editor.isDestroyed) return;

  const commit = () => {
    if (editor.isDestroyed) return;
    const found = findImageNode(editor, placeholderSrc);
    if (!found) return; // node was deleted by the user while we were waiting
    const { state } = editor.view;
    if (result) {
      editor.view.dispatch(state.tr.setNodeMarkup(found.pos, undefined, {
        ...found.attrs,
        src: result.url,
        ...(result.id ? { attachmentId: result.id } : {}),
        ...(result.masterPath ? { masterPath: result.masterPath } : {}),
        ...(result.downloadUrl ? { downloadUrl: result.downloadUrl } : {}),
        ...(result.isAnimated ? { isAnimated: true } : {}),
      }));
    } else {
      editor.view.dispatch(state.tr.delete(found.pos, found.pos + found.nodeSize));
    }
  };

  if (!result) {
    commit();
    return;
  }

  // Find the DOM element to check viewport visibility
  const found = findImageNode(editor, placeholderSrc);
  if (!found) return;
  const domNode = editor.view.nodeDOM(found.pos);
  const imgEl = domNode instanceof HTMLElement
    ? (domNode.tagName === "IMG" ? domNode : domNode.querySelector("img"))
    : null;

  if (imgEl && isElementInViewport(imgEl)) {
    // Image is visible — preload the new URL so the swap is cache-instant
    const preload = new window.Image();
    preload.src = result.url;
    if (preload.complete) {
      commit();
    } else {
      preload.onload = commit;
      preload.onerror = commit; // swap anyway — don't leave placeholder forever
    }
  } else {
    // Off-screen — swap immediately, no visible flash possible
    commit();
  }
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
    Emoji,
    InlineMath,
    BlockMath,
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
      const raw = editor.getHTML();
      // Strip images with blob: src — these are pending uploads not yet resolved
      // to signed URLs. Prevents transient blob: URLs from being persisted to DB
      // if autosave fires before the upload round-trip completes.
      const clean = raw.replace(/<img\b[^>]*\bsrc="blob:[^"]*"[^>]*\/?>/gi, "");
      onContentChange(clean, editor.getText());
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
  const prevContentKeyRef = useRef<string | number | undefined>(undefined);
  useEffect(() => {
    if (!editor) return;
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

  // Attach-file wrapper: shell uploads → GrapheEditor inserts image into the editor.
  //
  // For previewable types (JPEG, PNG, GIF, WebP): insert a local blob: URL instantly so
  // the image appears while the upload runs in the background, then swap to the signed URL.
  //
  // For non-previewable types (HEIC on Chrome): insert an SVG "Uploading…" placeholder
  // so the user sees something immediately, then swap to the real image when ready.
  //
  // Swap strategy: if the image is visible in the viewport when the upload completes,
  // preload the new URL first so the swap is cache-instant and invisible. Off-screen
  // images are swapped immediately (no visible flash possible).
  //
  // blob: URLs (including SVG placeholder URLs) are stripped from the HTML passed to
  // onContentChange so they are never persisted to the database.
  const handleAttachFile = useCallback(async (file: File) => {
    if (!onAttachFile || !editor) return;

    const canPreview = BROWSER_RENDERABLE_IMAGE_TYPES.has(file.type);

    // Insert a placeholder immediately — either the real image from local memory,
    // or an SVG "uploading…" card for types the browser can't decode natively.
    const placeholderSrc = canPreview
      ? URL.createObjectURL(file)
      : makeUploadPlaceholder(file.name);

    editor.chain().focus().setImage({ src: placeholderSrc, alt: file.name }).run();

    const result = await onAttachFile(file);

    if (!result?.url) {
      // Upload failed — remove the placeholder
      swapImageNode(editor, placeholderSrc, null);
      URL.revokeObjectURL(placeholderSrc);
      return;
    }

    // Swap placeholder → permanent URL (preloads first if image is in view)
    swapImageNode(editor, placeholderSrc, result as UploadResult);
    URL.revokeObjectURL(placeholderSrc);
  }, [onAttachFile, editor]);

  // Clipboard paste: intercept image blobs and upload them (same placeholder pattern)
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

      const canPreview = BROWSER_RENDERABLE_IMAGE_TYPES.has(file.type);
      const placeholderSrc = canPreview
        ? URL.createObjectURL(file)
        : makeUploadPlaceholder(file.name);

      editor.chain().focus().setImage({ src: placeholderSrc, alt: file.name }).run();

      const result = await onAttachFile(file);

      if (!result?.url) {
        swapImageNode(editor, placeholderSrc, null);
        URL.revokeObjectURL(placeholderSrc);
        return;
      }

      swapImageNode(editor, placeholderSrc, result as UploadResult);
      URL.revokeObjectURL(placeholderSrc);
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
          bar) so the user can undo/redo without dismissing the keyboard. */}
      {bp === "mobile" && (
        <EditorToolbar
          editor={editor}
          showUndoRedo
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
