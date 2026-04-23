"use client";

import { useState } from "react";
import {
  FileText, FileSpreadsheet, Presentation, FileCode, Archive, File,
  Image as ImageIcon, Download, Trash2, Loader2, Paperclip, Menu,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAllAttachments,
  useDeleteAttachment,
  formatBytes,
  isImageType,
  type AttachmentRecord,
} from "@/hooks/use-attachments";
import { useAppStore } from "@/store";
import { useBreakpoint } from "@/hooks/use-mobile";

function fileIcon(mimeType: string) {
  if (isImageType(mimeType)) return <ImageIcon className="w-5 h-5 text-sky-400 shrink-0" />;
  if (mimeType === "application/pdf") return <FileText className="w-5 h-5 text-red-400 shrink-0" />;
  if (mimeType.includes("wordprocessingml")) return <FileText className="w-5 h-5 text-blue-400 shrink-0" />;
  if (mimeType.includes("spreadsheetml")) return <FileSpreadsheet className="w-5 h-5 text-green-400 shrink-0" />;
  if (mimeType.includes("presentationml")) return <Presentation className="w-5 h-5 text-orange-400 shrink-0" />;
  if (mimeType === "application/zip") return <Archive className="w-5 h-5 text-yellow-400 shrink-0" />;
  if (["application/json", "text/plain", "text/markdown", "text/csv"].includes(mimeType)) {
    return <FileCode className="w-5 h-5 text-muted-foreground shrink-0" />;
  }
  return <File className="w-5 h-5 text-muted-foreground shrink-0" />;
}

function AttachmentRow({ attachment, onDeleted }: { attachment: AttachmentRecord; onDeleted: () => void }) {
  const deleteMut = useDeleteAttachment();
  const selectNote = useAppStore(s => s.selectNote);
  const setFilter = useAppStore(s => s.setFilter);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const isImage = isImageType(attachment.fileType);
    const message = isImage
      ? "This image is embedded in your note. Deleting it will remove it from the note content too. Delete?"
      : "Delete this attachment?";
    if (!confirm(message)) return;
    setDeleting(true);
    try {
      await deleteMut.mutateAsync({ id: attachment.id, noteId: attachment.noteId });
      onDeleted();
    } catch {
      toast.error("Failed to delete attachment");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    if (!attachment.url) { toast.error("Download URL unavailable"); return; }
    const a = document.createElement("a");
    a.href = attachment.url;
    a.download = attachment.fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  const handleNoteClick = () => {
    setFilter("all");
    selectNote(attachment.noteId);
  };

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-panel-border hover:bg-panel-hover transition-colors group">
      {fileIcon(attachment.fileType)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate" title={attachment.fileName}>
          {attachment.fileName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{formatBytes(attachment.fileSize)}</span>
          {attachment.noteTitle && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <button
                onClick={handleNoteClick}
                className="text-xs text-primary/70 hover:text-primary transition-colors truncate max-w-[160px]"
                title={`Go to: ${attachment.noteTitle}`}
              >
                {attachment.noteTitle}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
        <button
          onClick={handleDownload}
          title="Download"
          className="p-1.5 rounded hover:bg-panel text-muted-foreground hover:text-foreground transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete"
          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function AllAttachments() {
  const { data: attachments = [], isLoading, refetch } = useAllAttachments();
  const { setSidebarOpen } = useAppStore();
  const bp = useBreakpoint();

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      <div className="px-4 py-4 border-b border-panel-border shrink-0 flex items-center gap-3">
        {bp !== "desktop" && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-lg hover:bg-panel transition-colors shrink-0"
            title="Open menu"
          >
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        <div>
          <h2 className="text-base font-semibold text-foreground">Attachments</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {attachments.length === 0 && !isLoading ? "No attachments yet" : `${attachments.length} file${attachments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-panel border border-panel-border flex items-center justify-center mb-3">
              <Paperclip className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No attachments yet</p>
            <p className="text-xs text-muted-foreground">
              Attach files to your notes using the paperclip button or drag-and-drop.
            </p>
          </div>
        ) : (
          attachments.map(a => (
            <AttachmentRow key={a.id} attachment={a} onDeleted={refetch} />
          ))
        )}
      </div>
    </div>
  );
}
