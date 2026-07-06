// G13 (Phase 10.2): getSelectionHtml serializes a ProseMirror selection to HTML so
// AI actions preserve marks + block structure. Built on a real Tiptap editor (jsdom)
// so the serialization is exercised end to end, not mocked.
import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { getSelectionHtml } from "@/lib/editor-html";

function makeEditor(content: string): Editor {
  return new Editor({ extensions: [StarterKit], content });
}

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

describe("getSelectionHtml", () => {
  it("preserves inline marks (bold) across the whole selection", () => {
    editor = makeEditor("<p>plain <strong>bold</strong> text</p>");
    const html = getSelectionHtml(editor as Editor, 0, editor.state.doc.content.size);
    expect(html).toContain("<strong>bold</strong>");
  });

  it("keeps two paragraphs as separate blocks (not concatenated)", () => {
    editor = makeEditor("<p>first</p><p>second</p>");
    const html = getSelectionHtml(editor as Editor, 0, editor.state.doc.content.size);
    // Two <p> blocks survive — the old textBetween path merged them into "firstsecond".
    expect((html.match(/<p>/g) ?? []).length).toBe(2);
    expect(html).not.toContain("firstsecond");
  });

  it("preserves list structure", () => {
    editor = makeEditor("<ul><li>a</li><li>b</li></ul>");
    const html = getSelectionHtml(editor as Editor, 0, editor.state.doc.content.size);
    expect(html).toContain("<ul>");
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
  });

  it("returns empty string for a collapsed/empty range", () => {
    editor = makeEditor("<p>hello</p>");
    expect(getSelectionHtml(editor as Editor, 3, 3)).toBe("");
    expect(getSelectionHtml(editor as Editor, 5, 2)).toBe("");
  });
});
