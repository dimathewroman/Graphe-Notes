// G13 (Phase 10.2): AI actions round-trip the selection as HTML instead of the
// flattened plain text `textBetween` returns. HTML preserves inline marks
// (bold/italic/links) and block structure (paragraphs, lists) — and, as a bonus,
// two paragraphs come across as `<p>…</p><p>…</p>` rather than being concatenated.

import { DOMSerializer } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

// Serialize the selected range to an HTML string. Runs in the browser (needs
// `document`); returns "" for an empty/collapsed range. The AI result is inserted
// back via Tiptap's `insertContentAt`, which already parses HTML strings — so the
// round-trip preserves formatting end to end without a markdown step.
export function getSelectionHtml(editor: Editor, from: number, to: number): string {
  if (from >= to) return "";
  const slice = editor.state.doc.slice(from, to);
  const container = document.createElement("div");
  container.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content));
  return container.innerHTML;
}
