// Version history panel — slide-over right (desktop) / bottom sheet (mobile).
//
// Lists every saved version of the current note newest-first, with timestamp,
// inline-editable label, source badge, and content preview. Click a row to
// preview the version in the editor area; the parent owns the preview state.
//
// Demo and real mode share this component — useNoteVersionsList branches
// internally so the panel itself doesn't care which backend is in play.

import { useEffect, useRef, useState } from "react";
import {
  X,
  Clock,
  Loader2,
  Trash2,
  Pencil,
  Check,
  Sparkles,
  Save,
  History,
  RotateCcw,
} from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { cn } from "@/lib/utils";
import { VersionPreviewArea } from "./VersionPreviewArea";
import { Sheet, SheetContent } from "./ui/sheet";
import {
  useNoteVersionsList,
  useNoteVersionDetail,
  useUpdateNoteVersionLabel,
  useDeleteNoteVersion,
  type NoteVersionFull,
  type NoteVersionMeta,
  type VersionSource,
} from "@/hooks/use-note-versions";

interface Props {
  noteId: number;
  bp: "mobile" | "tablet" | "desktop";
  previewVersionId: number | null;
  // Mobile-only: the inline preview is rendered inside the bottom sheet, so
  // the panel needs the full version data + live state to show snapshot/diff.
  // These are unused on tablet/desktop where the preview lives in NoteShell.
  previewVersion?: NoteVersionFull | null;
  currentTitle?: string;
  currentContent?: string;
  currentContentText?: string;
  onPreview: (version: NoteVersionFull | null) => void;
  onRestoreVersion?: (version: NoteVersionFull) => void;
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) {
    return `Yesterday at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  }
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function sourceLabel(source: VersionSource | null): { text: string; icon: React.ReactNode } | null {
  switch (source) {
    case "manual_save":
      return { text: "Saved", icon: <Save className="w-2.5 h-2.5" /> };
    case "auto_save":
      return { text: "Auto", icon: <Clock className="w-2.5 h-2.5" /> };
    case "pre_ai_rewrite":
      return { text: "Pre-AI", icon: <Sparkles className="w-2.5 h-2.5" /> };
    case "restore":
      return { text: "Restore", icon: <History className="w-2.5 h-2.5" /> };
    case "auto_close":
      return { text: "On close", icon: <X className="w-2.5 h-2.5" /> };
    default:
      return null;
  }
}

export function VersionHistoryPanel({
  noteId,
  bp,
  previewVersionId,
  previewVersion,
  currentTitle,
  currentContent,
  currentContentText,
  onPreview,
  onRestoreVersion,
  onClose,
}: Props) {
  const isMobile = bp === "mobile";
  const { data: versions, isLoading } = useNoteVersionsList(noteId);
  const { data: previewData } = useNoteVersionDetail(noteId, previewVersionId);
  const inlinePreviewActive =
    isMobile && previewVersion != null && (previewVersion.content?.length ?? 0) > 0;
  const updateLabelMut = useUpdateNoteVersionLabel();
  const deleteMut = useDeleteNoteVersion();

  // When the preview version's full content arrives, push it to the parent so
  // the editor area can render it. (The list rows only carry contentText.)
  useEffect(() => {
    if (previewVersionId == null) return;
    if (previewData && previewData.id === previewVersionId) {
      onPreview(previewData);
    }
    // We intentionally don't include onPreview in deps to avoid re-firing on
    // every parent re-render — onPreview is stable in NoteShell anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewData, previewVersionId]);

  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLabelId != null) {
      labelInputRef.current?.focus();
      labelInputRef.current?.select();
    }
  }, [editingLabelId]);

  const startEdit = (v: NoteVersionMeta) => {
    setEditingLabelId(v.id);
    setLabelDraft(v.label ?? "");
  };

  const commitEdit = async () => {
    if (editingLabelId == null) return;
    const id = editingLabelId;
    const label = labelDraft.trim();
    setEditingLabelId(null);
    setLabelDraft("");
    await updateLabelMut.mutateAsync({ noteId, versionId: id, label: label || null });
  };

  const cancelEdit = () => {
    setEditingLabelId(null);
    setLabelDraft("");
  };

  const handleDelete = async (id: number) => {
    await deleteMut.mutateAsync({ noteId, versionId: id });
    if (previewVersionId === id) onPreview(null);
    setConfirmDeleteId(null);
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        showCloseButton={false}
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "bg-panel flex flex-col p-0",
          isMobile
            ? "h-[calc(100vh-64px)] rounded-t-2xl border-t border-panel-border"
            : "w-[360px] border-l border-panel-border"
        )}
        aria-label="Version history"
      >
        {/* Header */}
        <div className="h-14 border-b border-panel-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <Clock className="w-4 h-4 text-primary" />
            {inlinePreviewActive ? "Previewing version" : "Version history"}
          </div>
          <IconButton onClick={onClose} title="Close">
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        {inlinePreviewActive && previewVersion ? (
          <VersionPreviewArea
            version={previewVersion}
            currentTitle={currentTitle ?? ""}
            currentContent={currentContent ?? ""}
            currentContentText={currentContentText ?? ""}
            onRestore={() => onRestoreVersion?.(previewVersion)}
            onBack={() => onPreview(null)}
            variant="inline"
            compact
          />
        ) : (
        <>
        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !versions || versions.length === 0 ? (
            <div className="p-8 text-center">
              <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-foreground font-medium">No saved versions yet</p>
              <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
                Versions are saved automatically as you write and any time you
                hit Cmd+S or run an AI rewrite.
              </p>
            </div>
          ) : (
            <ul className="py-2">
              {versions.map((v) => {
                const isSelected = previewVersionId === v.id;
                const isEditing = editingLabelId === v.id;
                const badge = sourceLabel(v.source);
                const preview = (v.contentText ?? "").trim().slice(0, 80);

                return (
                  <li key={v.id} className="px-2">
                    <div
                      className={cn(
                        "group rounded-lg border transition-colors cursor-pointer shadow-sm",
                        isSelected
                          ? "bg-background border-primary/60"
                          : "bg-background/50 border-transparent hover:bg-background/80 hover:border-panel-border",
                      )}
                      onClick={() => {
                        if (isEditing) return;
                        if (isSelected) {
                          onPreview(null);
                        } else {
                          // Promote the meta row to a stub NoteVersionFull so
                          // the parent can flip into preview mode immediately.
                          // useNoteVersionDetail will refetch and call
                          // onPreview again with the real `content` once it
                          // arrives.
                          onPreview({ ...v, content: "" });
                        }
                      }}
                    >
                      <div className="px-3 py-2.5 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Timestamp + badge */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12px] font-medium text-foreground">
                              {formatTimestamp(v.createdAt)}
                            </span>
                            {badge && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground bg-panel px-1.5 py-0.5 rounded">
                                {badge.icon}
                                {badge.text}
                              </span>
                            )}
                          </div>

                          {/* Label (editable) */}
                          {isEditing ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <input
                                ref={labelInputRef}
                                value={labelDraft}
                                onChange={(e) => setLabelDraft(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { e.preventDefault(); void commitEdit(); }
                                  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                                }}
                                placeholder="Add a label…"
                                maxLength={200}
                                className="flex-1 min-w-0 text-[14px] font-medium bg-panel border border-panel-border rounded px-1.5 py-0.5 outline-none focus:border-primary/60"
                              />
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => { e.stopPropagation(); void commitEdit(); }}
                                className="text-primary p-1 rounded hover:bg-panel"
                                title="Save label"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : v.label ? (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-[14px] font-medium text-primary truncate">
                                {v.label}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); startEdit(v); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-0.5"
                                title="Edit label"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); startEdit(v); }}
                              className="mt-1 text-[12px] text-muted-foreground/70 hover:text-foreground inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Pencil className="w-3 h-3" />
                              Add label
                            </button>
                          )}

                          {/* Content preview */}
                          {preview && (
                            <p className="mt-1.5 text-[14px] text-muted-foreground line-clamp-2 leading-snug">
                              {preview}
                              {(v.contentText?.length ?? 0) > 80 ? "…" : ""}
                            </p>
                          )}
                        </div>

                        {/* Delete (hover-reveal on desktop, always visible on mobile) */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {confirmDeleteId === v.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); void handleDelete(v.id); }}
                                className="text-[11px] font-medium px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:opacity-90"
                              >
                                Delete
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                className="text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(v.id); }}
                              className={cn(
                                "p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground",
                                isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                              )}
                              title="Delete version"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="px-3 pb-2.5 -mt-1 flex items-center gap-1.5 text-[11px] text-primary">
                          <RotateCcw className="w-3 h-3" />
                          Previewing in editor
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-panel-border p-3 text-[11px] text-muted-foreground text-center">
          Up to 50 versions kept
        </div>
        </>
        )}
      </SheetContent>
    </Sheet>
  );
}
