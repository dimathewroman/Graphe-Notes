import { useState, useEffect, useCallback } from "react";
import { X, Clock, RotateCcw, Loader2, Trash2, ChevronRight } from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { cn } from "@/lib/utils";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";

interface NoteVersionMeta {
  id: number;
  noteId: number;
  title: string;
  contentText: string | null;
  createdAt: string;
}

interface NoteVersionFull extends NoteVersionMeta {
  content: string;
}

interface Props {
  noteId: number;
  onRestore: (content: string, title: string) => void;
  onClose: () => void;
}

function wordCount(text: string | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatVersionDate(iso: string): { relative: string; absolute: string } {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  let relative: string;
  if (mins < 1) relative = "Just now";
  else if (mins < 60) relative = `${mins}m ago`;
  else if (hrs < 24) relative = `${hrs}h ago`;
  else if (days === 1) relative = "Yesterday";
  else if (days < 7) relative = `${days} days ago`;
  else relative = d.toLocaleDateString();

  const absolute = d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return { relative, absolute };
}

export function VersionHistoryPanel({ noteId, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<NoteVersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NoteVersionFull | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authenticatedFetch(`/api/notes/${noteId}/versions`);
      const data = await r.json() as { versions: NoteVersionMeta[] };
      setVersions(data.versions ?? []);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const selectVersion = async (v: NoteVersionMeta) => {
    if (selected?.id === v.id) { setSelected(null); return; }
    setLoadingPreview(true);
    try {
      const r = await authenticatedFetch(`/api/notes/${noteId}/versions/${v.id}`);
      const data = await r.json() as { version: NoteVersionFull };
      setSelected(data.version);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      await authenticatedFetch(`/api/notes/${noteId}/versions/${id}`, { method: "DELETE" });
      if (selected?.id === id) setSelected(null);
      setVersions(vs => vs.filter(v => v.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    if (!selected) return;
    setRestoring(true);
    try {
      // Call the restore endpoint to recover soft-deleted attachments and replace
      // any hard-purged image references with a placeholder before loading the content.
      const r = await authenticatedFetch(
        `/api/notes/${noteId}/versions/${selected.id}/restore`,
        { method: "POST" }
      );
      if (r.ok) {
        const data = await r.json() as { content: string; title: string };
        onRestore(data.content, data.title);
      } else {
        // Fallback: restore with original content if endpoint fails
        onRestore(selected.content, selected.title);
      }
    } catch {
      onRestore(selected.content, selected.title);
    } finally {
      setRestoring(false);
      onClose();
    }
  };

  return (
    <div className="absolute inset-y-0 right-0 w-full md:w-80 bg-panel border-l border-panel-border flex flex-col z-20 shadow-2xl">
      {/* Header */}
      <div className="h-14 border-b border-panel-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="w-4 h-4 text-primary" />
          Version History
        </div>
        <IconButton onClick={onClose} title="Close">
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No saved versions yet.
            <p className="mt-1 text-xs">Versions are saved automatically every 5 minutes while you write.</p>
          </div>
        ) : (
          <div className="py-1">
            {versions.map((v) => {
              const { relative, absolute } = formatVersionDate(v.createdAt);
              const isSelected = selected?.id === v.id;
              const wc = wordCount(v.contentText);
              return (
                <div key={v.id}>
                  <button
                    onClick={() => selectVersion(v)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-background/60 transition-colors group",
                      isSelected && "bg-background/80 border-l-2 border-primary"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium truncate">{relative}</span>
                        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", isSelected && "rotate-90")} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{absolute}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {v.title} · {wc} {wc === 1 ? "word" : "words"}
                      </div>
                    </div>
                  </button>

                  {/* Preview pane when selected */}
                  {isSelected && (
                    <div className="border-t border-b border-panel-border bg-background/40 mx-2 mb-1 rounded-lg overflow-hidden">
                      {loadingPreview ? (
                        <div className="flex items-center justify-center h-20">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="p-3">
                          <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                            {selected.contentText || "(empty note)"}
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={handleRestore}
                              disabled={restoring}
                              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity font-medium disabled:opacity-60"
                            >
                              {restoring
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <RotateCcw className="w-3 h-3" />}
                              Restore
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, v.id)}
                              disabled={deleting === v.id}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1.5"
                            >
                              {deleting === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-panel-border p-3 text-xs text-muted-foreground text-center">
        Up to 50 versions · auto-saved every 5 min
      </div>
    </div>
  );
}
