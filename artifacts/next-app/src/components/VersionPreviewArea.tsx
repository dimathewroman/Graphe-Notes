// Read-only overlay that previews a saved version inside the editor area.
//
// Sits absolutely on top of GrapheEditor while the user has a version selected
// in the history panel. Two viewing modes:
//   • Snapshot — renders version.content as styled HTML (matches editor look)
//   • Diff     — runs diff-match-patch on the plaintext (version vs current)
//                and highlights insertions/deletions inline.
//
// Restoring is non-destructive; the parent (NoteShell) creates a "Before
// restore" snapshot first and then replaces editor content + title.

import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, FileText, GitCompare } from "lucide-react";
// diff-match-patch ships as `export = ` (CommonJS class). esModuleInterop is on
// in tsconfig, so the default import gives us the constructor.
import DiffMatchPatch from "diff-match-patch";
import { cn } from "@/lib/utils";
import type { NoteVersionFull } from "@/hooks/use-note-versions";

interface Props {
  version: NoteVersionFull;
  currentTitle: string;
  currentContent: string;
  currentContentText: string;
  onRestore: () => void;
  onBack: () => void;
  // "overlay"  → absolute fill, used by NoteShell on tablet/desktop where the
  //              preview covers the live editor area.
  // "inline"   → fills its parent (no absolute positioning, no z-index), used
  //              by VersionHistoryPanel on mobile where the preview lives
  //              inside the bottom sheet.
  variant?: "overlay" | "inline";
  // Compact banner with smaller padding for the mobile bottom-sheet variant.
  compact?: boolean;
}

function formatBannerTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Build inline diff segments from two plain-text strings. We use semantic
// cleanup so the diff lines up on word boundaries instead of single characters.
type DiffSegment = { op: -1 | 0 | 1; text: string };
function computeDiff(oldText: string, newText: string): DiffSegment[] {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldText ?? "", newText ?? "");
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({ op: op as -1 | 0 | 1, text }));
}

export function VersionPreviewArea({
  version,
  currentContentText,
  onRestore,
  onBack,
  variant = "overlay",
  compact = false,
}: Props) {
  const [showDiff, setShowDiff] = useState(false);

  const diffSegments = useMemo(
    () =>
      showDiff
        ? computeDiff(currentContentText ?? "", version.contentText ?? "")
        : [],
    [showDiff, currentContentText, version.contentText],
  );

  const rootClass =
    variant === "overlay"
      ? "absolute inset-0 z-20 flex flex-col bg-editor"
      : "flex flex-col bg-editor h-full min-h-0";
  // Compact stacks vertically (title row + button row) so the buttons get the
  // full width and don't squeeze the title into a single-word column.
  const bannerInnerClass = compact
    ? "px-3 py-2 flex flex-col gap-2"
    : "max-w-3xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap";
  const contentOuterClass = compact
    ? "px-4 py-5"
    : "max-w-3xl mx-auto px-6 py-8";

  return (
    <div className={cn(rootClass)}>
      {/* Banner */}
      <div className="shrink-0 border-b border-panel-border bg-panel/60 backdrop-blur-sm">
        <div className={bannerInnerClass}>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Viewing earlier version
            </div>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-medium text-foreground">
                {formatBannerTimestamp(version.createdAt)}
              </span>
              {version.label && (
                <span className="text-[12px] text-primary truncate">
                  · {version.label}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Snapshot / Diff toggle */}
            <div className="inline-flex rounded-md border border-panel-border bg-background/40 p-0.5">
              <button
                type="button"
                onClick={() => setShowDiff(false)}
                className={cn(
                  "inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded transition-colors",
                  !showDiff
                    ? "bg-panel text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Show snapshot"
              >
                <FileText className="w-3 h-3" />
                Snapshot
              </button>
              <button
                type="button"
                onClick={() => setShowDiff(true)}
                className={cn(
                  "inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded transition-colors",
                  showDiff
                    ? "bg-panel text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Show changes vs current"
              >
                <GitCompare className="w-3 h-3" />
                Changes
              </button>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground border border-panel-border px-2.5 py-1 rounded-md hover:bg-panel transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary-foreground bg-primary hover:bg-primary-hover px-2.5 py-1 rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {compact ? "Restore" : "Restore this version"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={contentOuterClass}>
          {/* Title (read-only) */}
          {version.title && (
            <h1 className="text-3xl font-bold text-foreground mb-6 break-words">
              {version.title}
            </h1>
          )}

          {showDiff ? (
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap font-sans text-foreground">
              {diffSegments.length === 0 ? (
                <p className="text-muted-foreground italic">
                  No textual differences between this version and the current
                  note.
                </p>
              ) : (
                diffSegments.map((seg, i) => {
                  if (seg.op === 0) {
                    return <span key={i}>{seg.text}</span>;
                  }
                  if (seg.op === -1) {
                    return (
                      <span
                        key={i}
                        className="bg-destructive/20 text-destructive line-through decoration-destructive/60 rounded-sm px-0.5"
                      >
                        {seg.text}
                      </span>
                    );
                  }
                  return (
                    <span
                      key={i}
                      className="bg-primary/20 text-primary rounded-sm px-0.5"
                    >
                      {seg.text}
                    </span>
                  );
                })
              )}
            </div>
          ) : (
            <div
              className="prose prose-invert max-w-none"
              // Version content is HTML produced by our own TipTap editor and
              // already lived in the user's note — rendering it as-is is the
              // whole point of "preview".
              dangerouslySetInnerHTML={{ __html: version.content }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
