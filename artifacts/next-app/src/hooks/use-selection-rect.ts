import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { getSelectionHtml } from "@/lib/editor-html";

/**
 * Shared text-selection tracker for the AI selection menus (R6). Watches the
 * editor selection and returns the bounding rect of the current non-empty text
 * selection (null when there's nothing actionable), capturing the selected text
 * up-front via `onSelectionCapture` before any menu interaction can disturb it.
 *
 * Options:
 * - `onBlur` — extra cleanup to run when the editor blurs (e.g. close a submenu).
 * - `listenSelectionChange` — also listen to `document.selectionchange` (Android
 *   Chrome's drag-handle selection doesn't reliably fire ProseMirror's
 *   selectionUpdate, so the menu would otherwise never appear on the first drag).
 */
export function useSelectionRect(
  editor: Editor | null,
  visible: boolean,
  onSelectionCapture: (from: number, to: number, text: string) => void,
  opts?: { onBlur?: () => void; listenSelectionChange?: boolean },
): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  // Ref-mirror onBlur so a fresh inline callback each render doesn't re-subscribe
  // the editor listeners (preserves the original effect's dep array).
  const onBlurRef = useRef(opts?.onBlur);
  onBlurRef.current = opts?.onBlur;
  const listenSelectionChange = opts?.listenSelectionChange ?? false;

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      if (!visible) { setRect(null); return; }
      const { from, to } = editor.state.selection;
      if (from === to) { setRect(null); return; }
      // Suppress on node selections (e.g. image clicks) — no text to act on
      if (editor.state.selection instanceof NodeSelection) { setRect(null); return; }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setRect(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width === 0) { setRect(null); return; }
      setRect(r);
      // Capture the selection NOW — before any menu interaction disturbs it.
      // G13: capture as HTML so AI actions preserve marks + block structure.
      const html = getSelectionHtml(editor, from, to);
      onSelectionCapture(from, to, html);
    };

    const handleBlur = () => setTimeout(() => { setRect(null); onBlurRef.current?.(); }, 150);

    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    editor.on("blur", handleBlur);
    if (listenSelectionChange) document.addEventListener("selectionchange", update);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
      editor.off("blur", handleBlur);
      if (listenSelectionChange) document.removeEventListener("selectionchange", update);
    };
  }, [editor, visible, onSelectionCapture, listenSelectionChange]);

  return rect;
}
