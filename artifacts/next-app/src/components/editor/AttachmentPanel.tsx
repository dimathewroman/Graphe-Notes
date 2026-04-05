"use client";

import { useState } from "react";
import {
  FileText, FileSpreadsheet, Presentation, FileCode, Archive, File,
  Download, Trash2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useNoteAttachments,
  useDeleteAttachment,
  formatBytes,
  isImageType,
  type AttachmentRecord,
} from "@/hooks/use-attachments";

function fileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <FileText className="w-5 h-5 text-red-400 shrink-0" />;
  if (mimeType.includes("wordprocessingml")) return <FileText className="w-5 h-5 text-blue-400 shrink-0" />;
  if (mimeType.includes("spreadsheetml")) return <FileSpreadsheet className="w-5 h-5 text-green-400 shrink-0" />;
  if (mimeType.includes("presentationml")) return <Presentation className="w-5 h-5 text-orange-400 shrink-0" />;
  if (mimeType === "application/zip") return <Archive className="w-5 h-5 text-yellow-400 shrink-0" />;
  if (mimeType === "application/json" || mimeType === "text/plain" || mimeType === "text/markdown" || mimeType === "text/csv") {
    return <FileCode className="w-5 h-5 text-muted-foreground shrink-0" />;
  }
  return <File className="w-5 h-5 text-muted-foreground shrink-0" />;
}

function AttachmentCard({ attachment, onDeleted }: { attachment: AttachmentRecord; onDeleted: () => void }) {
  const deleteMut = useDeleteAttachment();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this attachment?")) return;
    setDeleting(true);
    try {
      await deleteMut.mutateAsync(attachment.id);
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

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-panel border border-panel-border hover:border-primary/30 transition-colors group">
      {fileIcon(attachment.fileType)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate" title={attachment.fileName}>
          {attachment.fileName}
        </p>
        <p className="text-xs text-muted-foreground">{formatBytes(attachment.fileSize)}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={handleDownload}
          title="Download"
          className="p-1.5 rounded hover:bg-panel-hover text-muted-foreground hover:text-foreground transition-colors"
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

export function AttachmentPanel({ noteId }: { noteId: number }) {
  const { data: attachments = [], refetch } = useNoteAttachments(noteId);
  const nonImages = attachments.filter(a => !isImageType(a.fileType));

  if (nonImages.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        Attachments
      </p>
      <div className="flex flex-col gap-1.5">
        {nonImages.map(a => (
          <AttachmentCard key={a.id} attachment={a} onDeleted={refetch} />
        ))}
      </div>
    </div>
  );
}

// Uploading placeholder card shown while a file is being uploaded
export function UploadingCard({ fileName }: { fileName: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-panel border border-panel-border">
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground">Uploading…</p>
      </div>
    </div>
  );
}
