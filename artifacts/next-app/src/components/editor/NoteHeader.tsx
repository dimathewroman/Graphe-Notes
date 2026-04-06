// Top header bar: save status, back button, sidebar toggles, action icons, overflow/export menus.

import { memo } from "react";
import type { useEditor } from "@tiptap/react";
import {
  Pin, Star, ShieldCheck, Clock, Trash2,
  PanelLeft, PanelLeftClose, ArrowLeft, Undo2, Redo2, LayoutList,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn, formatDate } from "@/lib/utils";
import { OverflowMenu } from "./OverflowMenu";
import { ExportMenu } from "./ExportMenu";

// Fix 5: memo prevents re-renders when NoteEditor re-renders but props haven't changed
export const NoteHeader = memo(function NoteHeader({
  bp,
  note,
  saveStatus,
  isSidebarOpen,
  isNoteListOpen,
  editor,
  showToc,
  showVersionHistory,
  onToggleSidebar,
  onToggleNoteList,
  onBack,
  onPin,
  onFav,
  onVaultToggle,
  onVersionHistory,
  onSetShowToc,
  onExportPdf,
  onExportMarkdown,
  onDelete,
}: {
  bp: "mobile" | "tablet" | "desktop";
  note: { vaulted?: boolean | null; pinned?: boolean | null; favorite?: boolean | null; updatedAt?: string } | null | undefined;
  saveStatus: "saved" | "saving";
  isSidebarOpen: boolean;
  isNoteListOpen: boolean;
  editor: ReturnType<typeof useEditor>;
  showToc: boolean;
  showVersionHistory: boolean;
  onToggleSidebar: () => void;
  onToggleNoteList: () => void;
  onBack: () => void;
  onPin: () => void;
  onFav: () => void;
  onVaultToggle: () => void;
  onVersionHistory: () => void;
  onSetShowToc: (updater: boolean | ((prev: boolean) => boolean)) => void;
  onExportPdf: () => void;
  onExportMarkdown: () => void;
  onDelete: () => void;
}) {
  return (
    <header className="h-14 border-b border-panel-border flex items-center justify-between px-2 md:px-4 shrink-0 bg-editor/80 backdrop-blur-md z-10">
      <div className="flex items-center gap-2">
        {bp === "mobile" && (
          <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
          <div className="flex items-center gap-0.5 mr-2">
            {!isSidebarOpen && (
              <IconButton onClick={onToggleSidebar} title="Show sidebar">
                <PanelLeft className="w-4 h-4" />
              </IconButton>
            )}
            {!isNoteListOpen && (
              <IconButton onClick={onToggleNoteList} title="Show note list">
                <PanelLeftClose className="w-4 h-4 scale-x-[-1]" />
              </IconButton>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className={cn("inline-block w-1.5 h-1.5 rounded-full", saveStatus === "saved" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
          {saveStatus === "saved" ? "Saved" : "Saving..."}
          {bp === "desktop" && note && <span className="ml-2 border-l border-panel-border pl-2">Updated {formatDate(note.updatedAt ?? "")}</span>}
        </div>
      </div>

      <div className="flex items-center gap-0.5 md:gap-1">
        {bp === "mobile" && editor && (
          <>
            <IconButton
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo"
              className={!editor.can().undo() ? "opacity-30 pointer-events-none" : ""}
            >
              <Undo2 className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo"
              className={!editor.can().redo() ? "opacity-30 pointer-events-none" : ""}
            >
              <Redo2 className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => onSetShowToc(v => !v)}
              active={showToc}
              title="Table of contents"
            >
              <LayoutList className="w-4 h-4" />
            </IconButton>
          </>
        )}
        {bp !== "mobile" && (
          <>
            <IconButton onClick={onPin} active={note?.pinned ?? false} title="Pin Note">
              <Pin className={cn("w-4 h-4", note?.pinned && "fill-current")} />
            </IconButton>
            <IconButton onClick={onFav} active={note?.favorite ?? false} title="Favorite">
              <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
            </IconButton>
          </>
        )}
        {bp === "desktop" && (
          <>
            <IconButton
              onClick={onVaultToggle}
              active={note?.vaulted ?? false}
              title={note?.vaulted ? "Remove from vault" : "Move to vault"}
              className={note?.vaulted ? "text-indigo-400" : ""}
            >
              <ShieldCheck className={cn("w-4 h-4", note?.vaulted && "fill-current")} />
            </IconButton>
            <IconButton
              onClick={onVersionHistory}
              active={showVersionHistory}
              title="Version history"
            >
              <Clock className="w-4 h-4" />
            </IconButton>
            <IconButton
              onClick={() => onSetShowToc(v => !v)}
              active={showToc}
              title="Table of contents"
            >
              <LayoutList className="w-4 h-4" />
            </IconButton>
          </>
        )}
        {bp !== "desktop" && (
          <OverflowMenu
            note={note}
            onPin={onPin}
            onFav={onFav}
            onVaultToggle={onVaultToggle}
            onVersionHistory={onVersionHistory}
            onExportPdf={onExportPdf}
            onExportMarkdown={onExportMarkdown}
            onDelete={onDelete}
            showVersionHistory={showVersionHistory}
            isMobile={bp === "mobile"}
          />
        )}
        {bp === "desktop" && (
          <>
            <ExportMenu onExportPdf={onExportPdf} onExportMarkdown={onExportMarkdown} />
            <div className="w-px h-4 bg-panel-border mx-1" />
            <IconButton onClick={onDelete} className="hover:text-destructive hover:bg-destructive/10" title="Delete">
              <Trash2 className="w-4 h-4" />
            </IconButton>
          </>
        )}
      </div>
    </header>
  );
});
