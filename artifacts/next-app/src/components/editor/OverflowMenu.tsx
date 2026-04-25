import { useState } from "react";
import { Pin, Star, Share, Download, FileText, ShieldCheck, Clock, Search, Trash2, MoreVertical, LayoutTemplate } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function OverflowMenu({ note, onPin, onFav, onVaultToggle, onVersionHistory, onExportPdf, onExportMarkdown, onDelete, onSaveAsTemplate, showVersionHistory, isMobile }: {
  note: { vaulted?: boolean | null; pinned?: boolean | null; favorite?: boolean | null } | null | undefined;
  onPin?: () => void;
  onFav?: () => void;
  onVaultToggle: () => void;
  onVersionHistory: () => void;
  onExportPdf: () => void;
  onExportMarkdown: () => void;
  onDelete: () => void;
  onSaveAsTemplate?: () => void;
  showVersionHistory: boolean;
  isMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <IconButton active={open}>
          <MoreVertical className="w-4 h-4" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top">
        {isMobile && onPin && (
          <DropdownMenuItem onClick={onPin} className="gap-2.5 px-3 py-2.5">
            <Pin className={cn("w-4 h-4", note?.pinned && "fill-current text-primary")} />
            {note?.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
        )}
        {isMobile && onFav && (
          <DropdownMenuItem onClick={onFav} className="gap-2.5 px-3 py-2.5">
            <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
            {note?.favorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled className="gap-2.5 px-3 py-2.5 text-muted-foreground">
          <Share className="w-4 h-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPdf} className="gap-2.5 px-3 py-2.5">
          <Download className="w-4 h-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportMarkdown} className="gap-2.5 px-3 py-2.5">
          <FileText className="w-4 h-4" />
          Export as Markdown
        </DropdownMenuItem>
        {isMobile && (onPin || onFav) && <DropdownMenuSeparator className="bg-panel-border mx-2" />}
        <DropdownMenuItem onClick={onVaultToggle} className="gap-2.5 px-3 py-2.5">
          <ShieldCheck className={cn("w-4 h-4", note?.vaulted && "fill-current text-indigo-400")} />
          {note?.vaulted ? "Remove from Vault" : "Move to Vault"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onVersionHistory} className={cn("gap-2.5 px-3 py-2.5", showVersionHistory && "text-primary")}>
          <Clock className="w-4 h-4" />
          Version History
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2.5 px-3 py-2.5 text-muted-foreground">
          <Search className="w-4 h-4" />
          Find in Page
        </DropdownMenuItem>
        {onSaveAsTemplate && (
          <DropdownMenuItem onClick={onSaveAsTemplate} className="gap-2.5 px-3 py-2.5">
            <LayoutTemplate className="w-4 h-4" />
            Save as template
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-panel-border mx-2" />
        <DropdownMenuItem onClick={onDelete} className="gap-2.5 px-3 py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10">
          <Trash2 className="w-4 h-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
