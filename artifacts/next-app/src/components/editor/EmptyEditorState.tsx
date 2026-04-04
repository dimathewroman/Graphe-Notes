// "Select a note" placeholder shown on desktop when no note is selected.

import { FileText, PanelLeft, PanelLeftClose } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

export function EmptyEditorState({
  bp,
  isSidebarOpen,
  isNoteListOpen,
  onToggleSidebar,
  onToggleNoteList,
}: {
  bp: "mobile" | "tablet" | "desktop";
  isSidebarOpen: boolean;
  isNoteListOpen: boolean;
  onToggleSidebar: () => void;
  onToggleNoteList: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col bg-background relative">
      {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
        <div className="h-14 border-b border-panel-border flex items-center px-2 gap-1 bg-background/80 backdrop-blur-md shrink-0">
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
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <FileText className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-medium mb-2 text-foreground/80">Select a note</h2>
        <p className="text-sm">Choose a note from the list or create a new one to start writing.</p>
      </div>
    </div>
  );
}
