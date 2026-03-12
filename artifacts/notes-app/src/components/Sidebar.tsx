import { useState } from "react";
import {
  Folder, FolderOpen, FileText, Star,
  Settings, Hash, Plus, Trash2, Zap, Paperclip, Edit2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import {
  useGetFolders, useCreateFolder, useDeleteFolder, getGetFoldersQueryKey, useGetTags,
  useGetSmartFolders, useDeleteSmartFolder, getGetSmartFoldersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { IconButton } from "./ui/IconButton";
import { SmartFolderModal } from "./SmartFolderModal";

export function Sidebar() {
  const {
    activeFilter, activeFolderId, activeSmartFolderId, setFilter,
    isSidebarOpen, setSettingsOpen, setAIPanelOpen
  } = useAppStore();
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading: foldersLoading } = useGetFolders();
  const { data: tags = [] } = useGetTags();
  const { data: smartFolders = [] } = useGetSmartFolders();

  const createFolderMut = useCreateFolder({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() }) }
  });
  const deleteFolderMut = useDeleteFolder({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() }) }
  });
  const deleteSmartFolderMut = useDeleteSmartFolder({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSmartFoldersQueryKey() }) }
  });

  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [smartFolderModal, setSmartFolderModal] = useState<{ open: boolean; existing?: any }>({ open: false });

  const toggleFolder = (id: number) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedFolders(next);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createFolderMut.mutateAsync({ data: { name: newFolderName, sortOrder: folders.length, parentId: newFolderParentId } });
    setNewFolderName(""); setIsCreatingFolder(false); setNewFolderParentId(null);
  };

  if (!isSidebarOpen) return null;

  const rootFolders = folders.filter(f => !f.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const renderFolder = (folder: typeof folders[0], depth: number = 0) => {
    const children = folders.filter(f => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const isExpanded = expandedFolders.has(folder.id);
    const isActive = activeFilter === "folder" && activeFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "group flex items-center justify-between py-1.5 rounded-lg cursor-pointer transition-colors",
            isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
          )}
          style={{ paddingLeft: `${(depth + 1) * 12 + 4}px`, paddingRight: "8px" }}
          onClick={() => setFilter("folder", folder.id)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="p-0.5 hover:bg-panel rounded opacity-60 hover:opacity-100 shrink-0"
              onClick={e => { e.stopPropagation(); toggleFolder(folder.id); }}
            >
              {children.length > 0 ? (
                isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
              ) : (
                <Folder className="w-4 h-4 opacity-50" />
              )}
            </button>
            <span className="text-sm truncate">{folder.name}</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              className="p-1 hover:bg-panel rounded transition-colors"
              onClick={e => {
                e.stopPropagation();
                setNewFolderParentId(folder.id);
                setIsCreatingFolder(true);
                const next = new Set(expandedFolders);
                next.add(folder.id);
                setExpandedFolders(next);
              }}
              title="Add subfolder"
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              className="p-1 hover:bg-panel rounded transition-colors"
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Delete folder "${folder.name}"?`)) {
                  deleteFolderMut.mutate({ id: folder.id });
                  if (isActive) setFilter("all");
                }
              }}
              title="Delete folder"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </div>
        </div>

        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
        {isExpanded && isCreatingFolder && newFolderParentId === folder.id && (
          <div style={{ paddingLeft: `${(depth + 2) * 12 + 4}px`, paddingRight: "8px" }} className="mb-1">
            <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-background border border-panel-border rounded-lg px-2 py-1">
              <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onBlur={() => { if (!newFolderName) { setIsCreatingFolder(false); setNewFolderParentId(null); } }}
                placeholder="Subfolder name..."
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              />
            </form>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 border-r border-panel-border bg-panel flex flex-col h-screen shrink-0">
      {/* App header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Notes App</span>
        </div>
        <IconButton onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4" />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Top nav */}
        <div className="px-3 space-y-0.5 mb-4">
          <NavItem icon={<FileText className="w-4 h-4" />} label="All Notes" active={activeFilter === "all"} onClick={() => setFilter("all")} />
          <NavItem icon={<Star className="w-4 h-4" />} label="Favorites" active={activeFilter === "favorites"} onClick={() => setFilter("favorites")} />
          <NavItem icon={<Paperclip className="w-4 h-4" />} label="Attachments" active={activeFilter === "attachments"} onClick={() => setFilter("attachments")} />
        </div>

        {/* Folders section */}
        <div className="px-3 mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Folders</span>
          <button
            onClick={() => { setNewFolderParentId(null); setIsCreatingFolder(true); }}
            className="hover:text-foreground transition-colors p-1"
            title="New folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {isCreatingFolder && newFolderParentId === null && (
          <div className="px-3 mb-2">
            <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-background border border-panel-border rounded-lg px-2 py-1">
              <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onBlur={() => { if (!newFolderName) setIsCreatingFolder(false); }}
                placeholder="Folder name..."
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              />
            </form>
          </div>
        )}

        <div className="space-y-0 pr-2 mb-4">
          {foldersLoading ? (
            <div className="px-6 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : rootFolders.length === 0 ? (
            <div className="px-6 py-2 text-xs text-muted-foreground italic">No folders yet</div>
          ) : (
            rootFolders.map(f => renderFolder(f))
          )}
        </div>

        {/* Smart Folders section */}
        <div className="px-3 mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Smart Folders</span>
          <button
            onClick={() => setSmartFolderModal({ open: true })}
            className="hover:text-foreground transition-colors p-1"
            title="New smart folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0 pr-2 mb-4">
          {smartFolders.length === 0 ? (
            <div className="px-6 py-2 text-xs text-muted-foreground italic">No smart folders yet</div>
          ) : (
            smartFolders.map(sf => {
              const isActive = activeFilter === "smart-folder" && activeSmartFolderId === sf.id;
              return (
                <div key={sf.id} className="group">
                  <div
                    className={cn(
                      "flex items-center justify-between py-1.5 px-3 rounded-lg cursor-pointer transition-colors",
                      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
                    )}
                    onClick={() => setFilter("smart-folder", sf.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: sf.color || "#6366f1" }} />
                      <span className="text-sm truncate">{sf.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        className="p-1 hover:bg-panel rounded transition-colors"
                        onClick={e => { e.stopPropagation(); setSmartFolderModal({ open: true, existing: sf }); }}
                      >
                        <Edit2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1 hover:bg-panel rounded transition-colors"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete smart folder "${sf.name}"?`)) {
                            deleteSmartFolderMut.mutate({ id: sf.id });
                            if (isActive) setFilter("all");
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                  {sf.tagRules.length > 0 && (
                    <div className="pl-8 pr-3 pb-1 flex flex-wrap gap-1">
                      {sf.tagRules.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-panel border border-panel-border text-muted-foreground">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Tags section */}
        {tags.length > 0 && (
          <div className="mb-4">
            <div className="px-3 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</div>
            <div className="px-3 flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilter("tag", tag)}
                  className={cn(
                    "px-2 py-1 rounded-md text-xs transition-colors border",
                    activeFilter === "tag" && useAppStore.getState().activeTag === tag
                      ? "bg-primary/20 border-primary/30 text-primary"
                      : "bg-panel border-panel-border text-muted-foreground hover:text-foreground hover:bg-panel-hover"
                  )}
                >
                  <Hash className="w-3 h-3 inline mr-1 opacity-50" />
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Button */}
      <div className="p-4 border-t border-panel-border">
        <button
          onClick={() => setAIPanelOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 font-medium transition-all"
        >
          <Zap className="w-4 h-4" />
          <span>AI Assistant</span>
        </button>
      </div>

      {smartFolderModal.open && (
        <SmartFolderModal
          existing={smartFolderModal.existing}
          onClose={() => setSmartFolderModal({ open: false })}
        />
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 py-2 px-3 rounded-lg text-sm transition-all duration-200",
        active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
