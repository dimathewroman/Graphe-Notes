import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, Plus, Pin, Star, FileText, MoreVertical, Trash2, FolderInput, LayoutGrid, LayoutList, SortAsc, ChevronDown, Lock, Image as ImageIcon } from "lucide-react";
import { useAppStore } from "@/store";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useGetNotes, useCreateNote, useToggleNotePin, useToggleNoteFavorite,
  useDeleteNote, getGetNotesQueryKey, useGetFolders, useGetSmartFolders
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatDate } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";

interface ContextMenu {
  noteId: number;
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  x: number;
  y: number;
}

const SORT_OPTIONS = [
  { label: "Date edited (newest)", sortBy: "updatedAt" as const, sortDir: "desc" as const },
  { label: "Date edited (oldest)", sortBy: "updatedAt" as const, sortDir: "asc" as const },
  { label: "Date created (newest)", sortBy: "createdAt" as const, sortDir: "desc" as const },
  { label: "Date created (oldest)", sortBy: "createdAt" as const, sortDir: "asc" as const },
  { label: "Title (A → Z)", sortBy: "title" as const, sortDir: "asc" as const },
  { label: "Title (Z → A)", sortBy: "title" as const, sortDir: "desc" as const },
];

export function NoteList() {
  const {
    activeFilter, activeFolderId, activeSmartFolderId, activeTag,
    searchQuery, setSearchQuery, sortBy, sortDir, setSort,
    viewMode, setViewMode,
    selectedNoteId, selectNote
  } = useAppStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [moveMenuNoteId, setMoveMenuNoteId] = useState<number | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearchQuery(debouncedSearch); }, [debouncedSearch, setSearchQuery]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null); setMoveMenuNoteId(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const queryParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(activeFilter === "folder" && activeFolderId != null ? { folderId: activeFolderId } : {}),
    ...(activeFilter === "favorites" ? { favorite: true } : {}),
    ...(activeFilter === "tag" && activeTag ? { tag: activeTag } : {}),
    sortBy,
    sortDir
  };

  const { data: rawNotes = [], isLoading } = useGetNotes(queryParams);
  const { data: folders = [] } = useGetFolders();
  const { data: smartFolders = [] } = useGetSmartFolders();
  const queryClient = useQueryClient();

  // Smart folder filtering (client-side by tag rules)
  const activeSmartFolder = useMemo(() =>
    smartFolders.find(sf => sf.id === activeSmartFolderId),
    [smartFolders, activeSmartFolderId]
  );

  const getFirstImage = (content: string) => {
    const match = content.match(/<img[^>]+src="([^"]+)"/);
    return match ? match[1] : null;
  };

  const notes = useMemo(() => {
    let list = rawNotes;
    if (activeFilter === "smart-folder" && activeSmartFolder) {
      list = rawNotes.filter(n => n.tags.some(t => activeSmartFolder.tagRules.includes(t)));
    }
    if (activeFilter === "attachments") {
      list = rawNotes.filter(n => !!getFirstImage(n.content));
    }
    if (activeFilter === "favorites" || activeFilter === "tag" || activeFilter === "smart-folder" || activeFilter === "attachments") return list;
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [rawNotes, activeFilter, activeSmartFolder]);

  const createNoteMut = useCreateNote({
    mutation: {
      onSuccess: (newNote) => {
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
        selectNote(newNote.id);
      }
    }
  });
  const pinMut = useToggleNotePin({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }) } });
  const favMut = useToggleNoteFavorite({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }) } });
  const deleteMut = useDeleteNote({
    mutation: {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }); selectNote(null); }
    }
  });

  const handleCreateNew = () => {
    createNoteMut.mutate({
      data: {
        title: "Untitled Note",
        content: "<p></p>",
        folderId: activeFilter === "folder" ? activeFolderId : null
      }
    });
  };

  const handleContextMenu = (e: React.MouseEvent, note: typeof notes[0]) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ noteId: note.id, pinned: note.pinned, favorite: note.favorite, locked: note.locked, x: e.clientX, y: e.clientY });
    setMoveMenuNoteId(null);
  };

  const closeContextMenu = () => { setContextMenu(null); setMoveMenuNoteId(null); };

  const moveNote = (noteId: number, folderId: number | null) => {
    fetch(`/api/notes/${noteId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId })
    }).then(() => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }));
    closeContextMenu();
  };

  const listTitle = {
    all: "All Notes",
    pinned: "All Notes",
    favorites: "Favorites",
    folder: folders.find(f => f.id === activeFolderId)?.name || "Folder",
    tag: `#${activeTag}`,
    "smart-folder": activeSmartFolder?.name || "Smart Folder",
    attachments: "Attachments",
  }[activeFilter] || "Notes";

  const currentSort = SORT_OPTIONS.find(o => o.sortBy === sortBy && o.sortDir === sortDir);

  return (
    <div className={cn("border-r border-panel-border bg-background flex flex-col h-screen shrink-0 transition-all", viewMode === "gallery" ? "w-96" : "w-80")}>
      {/* Header */}
      <div className="p-4 border-b border-panel-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{listTitle}</h2>
          <div className="flex items-center gap-1">
            {/* View toggle */}
            <IconButton onClick={() => setViewMode(viewMode === "list" ? "gallery" : "list")} title={viewMode === "list" ? "Gallery view" : "List view"}>
              {viewMode === "list" ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </IconButton>
            {/* Sort menu */}
            <div className="relative" ref={sortMenuRef}>
              <IconButton onClick={() => setShowSortMenu(!showSortMenu)} title="Sort" active={showSortMenu}>
                <SortAsc className="w-4 h-4" />
              </IconButton>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 z-40 min-w-[210px] bg-popover border border-panel-border rounded-xl shadow-xl py-1">
                  <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Sort by</p>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={`${opt.sortBy}-${opt.sortDir}`}
                      onClick={() => { setSort(opt.sortBy, opt.sortDir); setShowSortMenu(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors",
                        sortBy === opt.sortBy && sortDir === opt.sortDir
                          ? "text-primary bg-primary/10"
                          : "text-foreground hover:bg-panel"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* New note */}
            <IconButton
              onClick={handleCreateNew}
              disabled={createNoteMut.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </IconButton>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="w-full bg-panel border border-panel-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Notes */}
      <div className={cn("flex-1 overflow-y-auto p-2", viewMode === "gallery" ? "grid grid-cols-2 gap-2 content-start" : "space-y-1")}>
        {isLoading ? (
          <div className={cn("flex justify-center", viewMode === "gallery" ? "col-span-2 p-4" : "p-4")}>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className={cn("p-8 text-center flex flex-col items-center justify-center text-muted-foreground", viewMode === "gallery" ? "col-span-2 h-full" : "h-full")}>
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No notes found.</p>
            {debouncedSearch && <p className="text-xs mt-1 opacity-70">Try a different search term.</p>}
          </div>
        ) : viewMode === "gallery" ? (
          notes.map(note => {
            const img = getFirstImage(note.content);
            return (
              <div
                key={note.id}
                onClick={() => selectNote(note.id)}
                onContextMenu={e => handleContextMenu(e, note)}
                className={cn(
                  "rounded-xl cursor-pointer border transition-all duration-200 group overflow-hidden",
                  selectedNoteId === note.id
                    ? "bg-panel border-primary/50 shadow-md shadow-primary/5"
                    : "bg-transparent border-transparent hover:bg-panel hover:border-panel-border"
                )}
              >
                {img && (
                  <div className="w-full h-24 overflow-hidden bg-panel">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-medium text-sm text-foreground/90 truncate flex-1 flex items-center gap-1">
                      {note.pinned && <Pin className="w-2.5 h-2.5 shrink-0 text-primary fill-primary" />}
                      {note.locked && <Lock className="w-2.5 h-2.5 shrink-0 text-amber-500" />}
                      {note.title || "Untitled Note"}
                    </h3>
                    <button onClick={e => { e.stopPropagation(); handleContextMenu(e, note); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-panel-border transition-all ml-1 shrink-0">
                      <MoreVertical className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {note.locked ? "🔒 Locked note" : (note.contentText || "No content")}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] text-muted-foreground/70 font-mono">{formatDate(note.updatedAt)}</span>
                    <div className="flex items-center gap-1">
                      {note.favorite && <Star className="w-2.5 h-2.5 fill-current text-yellow-500" />}
                      {img && <ImageIcon className="w-2.5 h-2.5 text-muted-foreground opacity-60" />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          notes.map(note => (
            <div
              key={note.id}
              onClick={() => selectNote(note.id)}
              onContextMenu={e => handleContextMenu(e, note)}
              className={cn(
                "p-3 rounded-xl cursor-pointer border transition-all duration-200 group relative",
                selectedNoteId === note.id
                  ? "bg-panel border-primary/50 shadow-md shadow-primary/5"
                  : "bg-transparent border-transparent hover:bg-panel hover:border-panel-border"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className={cn(
                  "font-medium truncate pr-2 text-sm flex items-center gap-1.5",
                  selectedNoteId === note.id ? "text-foreground" : "text-foreground/90"
                )}>
                  {note.pinned && <Pin className="w-3 h-3 shrink-0 text-primary fill-primary" />}
                  {note.locked && <Lock className="w-3 h-3 shrink-0 text-amber-500" />}
                  {note.title || "Untitled Note"}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  {note.favorite && <Star className="w-3 h-3 fill-current text-yellow-500 opacity-70" />}
                  <button
                    onClick={e => { e.stopPropagation(); handleContextMenu(e, note); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-panel-border transition-all"
                    title="Options"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                {note.locked ? "🔒 Locked note" : (note.contentText || "No content")}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground/70 font-mono">{formatDate(note.updatedAt)}</span>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex gap-1 overflow-hidden">
                    {note.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground border border-panel-border truncate max-w-[60px]">
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-panel text-muted-foreground">+{note.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[170px] bg-popover border border-panel-border rounded-xl shadow-lg shadow-black/20 py-1 overflow-visible"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <ContextMenuItem
            icon={<Pin className={cn("w-4 h-4", contextMenu.pinned && "fill-current text-primary")} />}
            label={contextMenu.pinned ? "Unpin" : "Pin to top"}
            onClick={() => { pinMut.mutate({ id: contextMenu.noteId }); closeContextMenu(); }}
          />
          <ContextMenuItem
            icon={<Star className={cn("w-4 h-4", contextMenu.favorite && "fill-current text-yellow-500")} />}
            label={contextMenu.favorite ? "Remove Favorite" : "Add to Favorites"}
            onClick={() => { favMut.mutate({ id: contextMenu.noteId }); closeContextMenu(); }}
          />
          {folders.length > 0 && (
            <>
              <div className="h-px bg-panel-border mx-2 my-1" />
              <div className="relative">
                <ContextMenuItem
                  icon={<FolderInput className="w-4 h-4" />}
                  label="Move to folder"
                  chevron
                  onClick={() => setMoveMenuNoteId(moveMenuNoteId === contextMenu.noteId ? null : contextMenu.noteId)}
                />
                {moveMenuNoteId === contextMenu.noteId && (
                  <div className="absolute left-full top-0 ml-1 min-w-[150px] bg-popover border border-panel-border rounded-xl shadow-lg py-1 z-50">
                    <ContextMenuItem icon={<FileText className="w-4 h-4" />} label="No folder" onClick={() => moveNote(contextMenu.noteId, null)} />
                    {folders.map(f => (
                      <ContextMenuItem key={f.id} icon={<FileText className="w-4 h-4" />} label={f.name} onClick={() => moveNote(contextMenu.noteId, f.id)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <div className="h-px bg-panel-border mx-2 my-1" />
          <ContextMenuItem
            icon={<Trash2 className="w-4 h-4" />}
            label="Delete"
            danger
            onClick={() => {
              if (confirm("Delete this note?")) deleteMut.mutate({ id: contextMenu.noteId });
              closeContextMenu();
            }}
          />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ icon, label, onClick, danger, chevron }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; chevron?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
        danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-panel"
      )}
    >
      <span className="opacity-70">{icon}</span>
      <span className="flex-1">{label}</span>
      {chevron && <span className="opacity-40 text-xs">›</span>}
    </button>
  );
}
