// Mobile/tablet overflow menu with note actions (pin, fav, vault, export, delete).

import { useEffect, useRef, useState } from "react";
import { Pin, Star, Share, Download, FileText, ShieldCheck, Clock, Search, Trash2, MoreVertical } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

export function OverflowMenu({ note, onPin, onFav, onVaultToggle, onVersionHistory, onExportPdf, onExportMarkdown, onDelete, showVersionHistory, isMobile }: {
  note: { vaulted?: boolean | null; pinned?: boolean | null; favorite?: boolean | null } | null | undefined;
  onPin?: () => void;
  onFav?: () => void;
  onVaultToggle: () => void;
  onVersionHistory: () => void;
  onExportPdf: () => void;
  onExportMarkdown: () => void;
  onDelete: () => void;
  showVersionHistory: boolean;
  isMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <IconButton onClick={() => setOpen(!open)}>
        <MoreVertical className="w-4 h-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-popover border border-panel-border rounded-xl shadow-2xl py-1">
          {isMobile && onPin && (
            <button onClick={() => { onPin(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
              <Pin className={cn("w-4 h-4", note?.pinned && "fill-current text-primary")} />
              {note?.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {isMobile && onFav && (
            <button onClick={() => { onFav(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
              <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
              {note?.favorite ? "Unfavorite" : "Favorite"}
            </button>
          )}
          <button onClick={() => { setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:bg-panel transition-colors cursor-default">
            <Share className="w-4 h-4" />
            Share
          </button>
          <button onClick={() => { onExportPdf(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
          <button onClick={() => { onExportMarkdown(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
            <FileText className="w-4 h-4" />
            Export as Markdown
          </button>
          {(isMobile && (onPin || onFav)) && <div className="h-px bg-panel-border mx-2 my-1" />}
          <button onClick={() => { onVaultToggle(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
            <ShieldCheck className={cn("w-4 h-4", note?.vaulted && "fill-current text-indigo-400")} />
            {note?.vaulted ? "Remove from Vault" : "Move to Vault"}
          </button>
          <button onClick={() => { onVersionHistory(); setOpen(false); }} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-panel transition-colors", showVersionHistory ? "text-primary" : "text-foreground")}>
            <Clock className="w-4 h-4" />
            Version History
          </button>
          <button onClick={() => { setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:bg-panel transition-colors cursor-default">
            <Search className="w-4 h-4" />
            Find in Page
          </button>
          <div className="h-px bg-panel-border mx-2 my-1" />
          <button onClick={() => { onDelete(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
