import { useState, useEffect } from "react";
import { Search, Plus, Filter, Pin, Star, Hash, FileText } from "lucide-react";
import { useAppStore } from "@/store";
import { useDebounce } from "@/hooks/use-debounce";
import { 
  useGetNotes, useCreateNote, getGetNotesQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatDate } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";

export function NoteList() {
  const { 
    activeFilter, activeFolderId, activeTag, 
    searchQuery, setSearchQuery, sortBy, sortDir, setSort,
    selectedNoteId, selectNote
  } = useAppStore();
  
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);
  
  // Sync debounce to store
  useEffect(() => { setSearchQuery(debouncedSearch); }, [debouncedSearch, setSearchQuery]);

  const queryParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(activeFilter === "folder" && activeFolderId != null ? { folderId: activeFolderId } : {}),
    ...(activeFilter === "pinned" ? { pinned: true } : {}),
    ...(activeFilter === "favorites" ? { favorite: true } : {}),
    ...(activeFilter === "tag" && activeTag ? { tag: activeTag } : {}),
    sortBy,
    sortDir
  };

  const { data: notes = [], isLoading } = useGetNotes(queryParams);
  const queryClient = useQueryClient();
  
  const createNoteMut = useCreateNote({
    mutation: {
      onSuccess: (newNote) => {
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
        selectNote(newNote.id);
      }
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

  // Get title based on filter
  const listTitle = {
    all: "All Notes",
    pinned: "Pinned Notes",
    favorites: "Favorites",
    folder: "Folder",
    tag: `#${activeTag}`
  }[activeFilter];

  return (
    <div className="w-80 border-r border-panel-border bg-background flex flex-col h-screen shrink-0">
      {/* Header & Search */}
      <div className="p-4 border-b border-panel-border flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{listTitle}</h2>
          <IconButton 
            onClick={handleCreateNew} 
            disabled={createNoteMut.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground shadow-sm"
          >
            <Plus className="w-4 h-4" />
          </IconButton>
        </div>
        
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text"
            placeholder="Search notes..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full bg-panel border border-panel-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-4 flex justify-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No notes found.</p>
            {debouncedSearch && <p className="text-xs mt-1 opacity-70">Try a different search term.</p>}
          </div>
        ) : (
          notes.map(note => (
            <div 
              key={note.id}
              onClick={() => selectNote(note.id)}
              className={cn(
                "p-3 rounded-xl cursor-pointer border transition-all duration-200 group",
                selectedNoteId === note.id 
                  ? "bg-panel border-primary/50 shadow-md shadow-primary/5" 
                  : "bg-transparent border-transparent hover:bg-panel hover:border-panel-border"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className={cn(
                  "font-medium truncate pr-2 text-sm",
                  selectedNoteId === note.id ? "text-foreground" : "text-foreground/90"
                )}>
                  {note.title || "Untitled Note"}
                </h3>
                <div className="flex items-center gap-1 shrink-0 opacity-60">
                  {note.pinned && <Pin className="w-3 h-3 fill-current text-primary" />}
                  {note.favorite && <Star className="w-3 h-3 fill-current text-yellow-500" />}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                {note.contentText || "No content"}
              </p>
              
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground/70 font-mono">
                  {formatDate(note.updatedAt)}
                </span>
                
                {note.tags && note.tags.length > 0 && (
                  <div className="flex gap-1 overflow-hidden">
                    {note.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground border border-panel-border truncate max-w-[60px]">
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-panel text-muted-foreground">+{note.tags.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
