// Phase 2.2: HTML rendered via dangerouslySetInnerHTML / injected into the DOM
// (version preview, template preview, PDF export) must be sanitized.
import { describe, it, expect } from "vitest";
import { sanitizeNoteHtml } from "@/lib/sanitize-html";

describe("sanitizeNoteHtml", () => {
  it("strips an <img onerror> payload", () => {
    const out = sanitizeNoteHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("alert(1)");
  });

  it("removes <script> tags", () => {
    const out = sanitizeNoteHtml('<p>hi</p><script>steal()</script>');
    expect(out).not.toContain("<script");
    expect(out).toContain("hi");
  });

  it("strips javascript: hrefs", () => {
    const out = sanitizeNoteHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });

  it("preserves safe rich formatting", () => {
    const out = sanitizeNoteHtml("<h1>Title</h1><p><strong>bold</strong> <em>x</em></p><ul><li>a</li></ul>");
    expect(out).toContain("<h1>");
    expect(out).toContain("<strong>");
    expect(out).toContain("<li>");
  });
});
