import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize note/template/version HTML before rendering it via
 * dangerouslySetInnerHTML (§S XSS). The content is our own Tiptap output, but it
 * can carry user-authored payloads (e.g. a pasted `<img onerror=...>` or a
 * template imported from another user), so we strip anything executable while
 * preserving the rich formatting we render (headings, tables, lists, links,
 * KaTeX spans, code blocks, images).
 */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
