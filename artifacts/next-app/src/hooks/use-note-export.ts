import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

function sanitizeFilename(title: string): string {
  return (title || "note").replace(/[/\\?%*:|"<>]/g, "-").trim() || "note";
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsMarkdown(title: string, html: string): void {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  td.use(gfm);

  // TipTap task items render checkboxes as <input type="checkbox"> inside <li>.
  // Turndown-gfm handles these, but ensure checked state is preserved.
  td.addRule("taskListItem", {
    filter(node) {
      return (
        node.nodeName === "LI" &&
        node.parentElement?.classList.contains("contains-task-list") === true
      );
    },
    replacement(content, node) {
      const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
      const checked = checkbox ? (checkbox as HTMLInputElement).checked : false;
      const text = content.replace(/^\s*\[[ x]\]\s*/i, "").trim();
      return `- [${checked ? "x" : " "}] ${text}\n`;
    },
  });

  const markdown = td.turndown(html);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${sanitizeFilename(title)}.md`);
}

export async function exportAsPdf(title: string, html: string): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:absolute;left:-9999px;top:0;";

  const content = document.createElement("div");
  content.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body, div { font-family: system-ui, -apple-system, sans-serif; }
      .pdf-content {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 15px;
        line-height: 1.7;
        color: #1a1a1a;
        max-width: 680px;
        padding: 40px 48px;
      }
      h1 { font-size: 2em; font-weight: 700; margin: 0.75em 0 0.4em; }
      h2 { font-size: 1.5em; font-weight: 700; margin: 0.75em 0 0.4em; }
      h3 { font-size: 1.25em; font-weight: 600; margin: 0.75em 0 0.4em; }
      h4 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0 0.3em; }
      h5, h6 { font-size: 1em; font-weight: 600; margin: 0.5em 0 0.3em; }
      p { margin: 0.6em 0; }
      strong, b { font-weight: 700; }
      em, i { font-style: italic; }
      u { text-decoration: underline; }
      s, del { text-decoration: line-through; }
      ul, ol { margin: 0.5em 0 0.5em 1.5em; }
      li { margin: 0.25em 0; }
      ul[data-type="taskList"] { list-style: none; margin-left: 0; }
      ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
      ul[data-type="taskList"] li input[type="checkbox"] { margin-top: 0.25em; flex-shrink: 0; }
      blockquote {
        border-left: 3px solid #d1d5db;
        margin: 0.75em 0;
        padding: 0.25em 0 0.25em 1em;
        color: #4b5563;
      }
      code {
        font-family: ui-monospace, monospace;
        font-size: 0.875em;
        background: #f3f4f6;
        border-radius: 3px;
        padding: 0.15em 0.35em;
      }
      pre {
        font-family: ui-monospace, monospace;
        font-size: 0.875em;
        background: #f3f4f6;
        border-radius: 6px;
        padding: 1em;
        margin: 0.75em 0;
        overflow-x: auto;
        white-space: pre-wrap;
      }
      pre code { background: none; padding: 0; }
      hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
      a { color: #2563eb; text-decoration: underline; }
      table { border-collapse: collapse; width: 100%; margin: 0.75em 0; }
      th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; text-align: left; }
      th { background: #f9fafb; font-weight: 600; }
      mark { background: #fef08a; border-radius: 2px; padding: 0 0.15em; }
      img { max-width: 100%; border-radius: 4px; }
    </style>
    <div class="pdf-content">${html}</div>
  `;

  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `${sanitizeFilename(title)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(content)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}
