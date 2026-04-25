import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationConfig } from "@/hooks/use-motion";
import {
  Search, Plus, Pin, Star, FileText, MoreVertical, Trash2, FolderInput,
  LayoutGrid, LayoutList, SortAsc, ShieldCheck, Image as ImageIcon, Hash, X, Tag, Menu, PanelLeftClose, PanelLeft,
  ChevronDown, LayoutTemplate, Zap
} from "lucide-react";
import { useAppStore } from "@/store";
import ReactDOM from "react-dom";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useGetNotes, useCreateNote, useToggleNotePin, useToggleNoteFavorite,
  useSoftDeleteNote, useUpdateNote, useToggleNoteVault, getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey, useGetFolders
} from "@workspace/api-client-react";
import type { Note } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { cn, formatDate } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";
import { useBreakpoint } from "@/hooks/use-mobile";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useDemoMode } from "@/lib/demo-context";
import { DEMO_NOTES } from "@/lib/demo-data";
import posthog from "posthog-js";

interface ContextMenu {
  noteId: number;
  pinned: boolean;
  favorite: boolean;
  vaulted: boolean;
  tags: string[];
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
  // Fix 5: atomic Zustand selectors — each subscription only re-renders on its own value change
  const activeFilter = useAppStore(s => s.activeFilter);
  const activeFolderId = useAppStore(s => s.activeFolderId);
  const activeTag = useAppStore(s => s.activeTag);
  const searchQuery = useAppStore(s => s.searchQuery);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const sortBy = useAppStore(s => s.sortBy);
  const sortDir = useAppStore(s => s.sortDir);
  const setSort = useAppStore(s => s.setSort);
  const viewMode = useAppStore(s => s.viewMode);
  const setViewMode = useAppStore(s => s.setViewMode);
  const selectedNoteId = useAppStore(s => s.selectedNoteId);
  const selectNote = useAppStore(s => s.selectNote);
  const setMobileView = useAppStore(s => s.setMobileView);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);
  const toggleNoteList = useAppStore(s => s.toggleNoteList);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const isVaultUnlocked = useAppStore(s => s.isVaultUnlocked);
  const demoExtraIds = useAppStore(s => s.demoExtraIds);
  const addDemoNoteId = useAppStore(s => s.addDemoNoteId);
  const openTemplatePicker = useAppStore(s => s.openTemplatePicker);
  const setFilter = useAppStore(s => s.setFilter);
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const anim = useAnimationConfig();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 300);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [plusMenuPos, setPlusMenuPos] = useState<{ bottom: number; right: number } | null>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusBtnRef = useRef<HTMLButtonElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [moveMenuNoteId, setMoveMenuNoteId] = useState<number | null>(null);
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSearchQuery(debouncedSearch); }, [debouncedSearch, setSearchQuery]);

  // Capture search_performed whenever the debounced query becomes non-empty.
  useEffect(() => {
    if (debouncedSearch.trim().length > 0) {
      posthog.capture("search_performed", { query: debouncedSearch, timestamp: new Date().toISOString() });
    }
  }, [debouncedSearch]);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null); setMoveMenuNoteId(null); setShowTagsPanel(false); setTagInput("");
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: foldersData } = useGetFolders();
  const folders = Array.isArray(foldersData) ? foldersData : [];
  const queryClient = useQueryClient();

  // Find the active folder and check if it has tag rules (smart folder)
  const activeFolder = useMemo(
    () => folders.find(f => f.id === activeFolderId),
    [folders, activeFolderId]
  );
  const isFolderSmart = activeFilter === "folder" && (activeFolder?.tagRules?.length ?? 0) > 0;

  // For smart folders, fetch all notes and filter client-side; otherwise use API filters
  const queryParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(activeFilter === "folder" && activeFolderId != null && !isFolderSmart ? { folderId: activeFolderId } : {}),
    ...(activeFilter === "favorites" ? { favorite: true } : {}),
    ...(activeFilter === "tag" && activeTag ? { tag: activeTag } : {}),
    sortBy,
    sortDir
  };

  const { data: apiNotes = [], isLoading: apiLoading } = useGetNotes(queryParams, { query: { enabled: !isDemo, queryKey: getGetNotesQueryKey(queryParams) } });

  // PERF: temporary benchmark — measures time from app start to notes-list data ready
  const didMarkMount = useRef(false);
  const didLogAppReady = useRef(false);
  useEffect(() => {
    // Mark when this component first mounts (post-auth, main app is rendering)
    if (!didMarkMount.current) {
      didMarkMount.current = true;
      performance.mark("app-mount");
    }
  }, []);
  useEffect(() => {
    if (!apiLoading && !isDemo && !didLogAppReady.current) {
      didLogAppReady.current = true;
      performance.mark("app-data-ready");
      try {
        const measure = performance.measure("app-ready", "app-mount", "app-data-ready");
        console.log(`[perf] app-ready (mount → first data): ${measure.duration.toFixed(1)}ms`);
      } catch {
        // app-mount mark may not exist if component remounted after hot reload
      }
    }
  }, [apiLoading, isDemo]);

  // Subscribe to each note's individual cache so pin/fav/vault/tag changes are reactive.
  // Only register these queries when in demo mode — if the array is always mounted,
  // initialData would write demo content into the cache even for authenticated users,
  // causing demo note content to flash when a real note shares an ID (1–14).
  const demoNoteQueries = useQueries({
    queries: isDemo
      ? [...DEMO_NOTES.map(n => n.id), ...demoExtraIds].map(id => {
          const fallback = DEMO_NOTES.find(n => n.id === id);
          return {
            queryKey: getGetNoteQueryKey(id),
            queryFn: fallback
              ? () => fallback
              : async () => queryClient.getQueryData<Note>(getGetNoteQueryKey(id)),
            initialData: fallback,
            staleTime: Infinity,
            gcTime: Infinity,
            enabled: true,
          };
        })
      : [],
  });
  // Deduplicate by id to guard against any transient duplicate query results during
  // HMR or isDemo transition renders.
  const rawNotes = isDemo
    ? ([...new Map(
        demoNoteQueries.map(q => q.data).filter(Boolean).map(n => [n!.id, n])
      ).values()] as typeof DEMO_NOTES)
    : apiNotes;
  const isLoading = isDemo ? false : apiLoading;

  const getFirstImage = (content: string) => {
    const match = content.match(/<img[^>]+src="([^"]+)"/);
    return match ? match[1] : null;
  };

  const notes = useMemo(() => {
    let list = rawNotes;

    // Demo mode: filter out soft-deleted notes and apply search/tag client-side
    if (isDemo) {
      list = list.filter((n: any) => !n._demoDeleted);
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        list = list.filter(n =>
          n.title.toLowerCase().includes(q) || n.contentText?.toLowerCase().includes(q)
        );
      }
      if (activeFilter === "tag" && activeTag) {
        list = list.filter(n => n.tags?.includes(activeTag));
      }
    }

    if (activeFilter === "vault" && isVaultUnlocked) {
      list = list.filter(n => n.vaulted);
    } else if (activeFilter === "vault" && !isVaultUnlocked) {
      list = [];
    } else {
      list = list.filter(n => !n.vaulted || isVaultUnlocked);

      if (isFolderSmart && activeFolder) {
        list = list.filter(n => n.tags.some(t => activeFolder.tagRules.includes(t)));
      } else if (isDemo && activeFilter === "folder" && activeFolderId != null) {
        list = list.filter(n => n.folderId === activeFolderId);
      }

      if (activeFilter === "attachments") {
        // Fix 2: content is now "" in list responses — check coverImage first, fall back to parsing content
        list = list.filter(n => !!n.coverImage || !!getFirstImage(n.content));
      }

      if (activeFilter === "favorites" && isDemo) {
        list = list.filter(n => n.favorite);
      }
    }

    // Helper: secondary sort key for demo mode (mirrors API sort options)
    const demoSecondarySort = (a: typeof list[0], b: typeof list[0]) => {
      if (!isDemo) return 0;
      if (sortBy === "title") {
        const cmp = (a.title || "").localeCompare(b.title || "");
        return sortDir === "asc" ? cmp : -cmp;
      }
      const dateA = new Date(sortBy === "updatedAt" ? a.updatedAt : a.createdAt).getTime();
      const dateB = new Date(sortBy === "updatedAt" ? b.updatedAt : b.createdAt).getTime();
      const cmp = dateA - dateB;
      return sortDir === "asc" ? cmp : -cmp;
    };

    if (activeFilter === "favorites") {
      return [...list].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return demoSecondarySort(a, b);
      });
    }

    if (activeFilter === "tag" || activeFilter === "attachments" || activeFilter === "vault") {
      return isDemo ? [...list].sort(demoSecondarySort) : list;
    }

    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return demoSecondarySort(a, b);
    });
  }, [rawNotes, activeFilter, isFolderSmart, activeFolder, isVaultUnlocked, isDemo, debouncedSearch, activeTag, sortBy, sortDir]);

  // Fix 6: prefetch first note after list loads — eliminates cold-start penalty for first click
  useEffect(() => {
    if (apiLoading || isDemo || notes.length === 0) return;
    const firstNote = notes[0];
    const cached = queryClient.getQueryData(getGetNoteQueryKey(firstNote.id));
    if (!cached) {
      queryClient.prefetchQuery({
        queryKey: getGetNoteQueryKey(firstNote.id),
        queryFn: () => authenticatedFetch(`/api/notes/${firstNote.id}`).then(r => r.json()),
        staleTime: 30_000,
      });
    }
  }, [apiLoading, isDemo, notes, queryClient]);

  const createNoteMut = useCreateNote({
    mutation: {
      onSuccess: (newNote) => {
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
        selectNote(newNote.id);
        if (bp === "mobile") setMobileView("editor");
        posthog.capture("note_created", { note_id: newNote.id, timestamp: new Date().toISOString() });
      }
    }
  });
  const pinMut = useToggleNotePin({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }) } });
  const favMut = useToggleNoteFavorite({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }) } });
  const vaultMut = useToggleNoteVault({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }) } });
  const softDeleteMut = useSoftDeleteNote({
    mutation: {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
        selectNote(null);
        if (bp === "mobile") setMobileView("list");
        posthog.capture("note_deleted", { note_id: variables.id, timestamp: new Date().toISOString() });
      }
    }
  });
  const updateNoteMut = useUpdateNote({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
      }
    }
  });

  const handleSelectNote = (id: number) => {
    // PERF: temporary benchmark — marks start of note-switch latency
    performance.mark("note-switch-start");
    selectNote(id);
    if (bp === "mobile") {
      setMobileView("editor");
    }
    posthog.capture("note_opened", { note_id: id, timestamp: new Date().toISOString() });
  };

  const handleCreateNew = () => {
    if (isDemo) {
      // Create a temporary note in the cache with a negative ID (won't persist)
      const tempId = -(Date.now());
      const tempNote = {
        id: tempId, title: "Untitled Note", content: "<p></p>", contentText: "",
        tags: [], pinned: false, favorite: false, vaulted: false,
        folderId: activeFilter === "folder" && !isFolderSmart ? activeFolderId : null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData(getGetNoteQueryKey(tempId), tempNote);
      addDemoNoteId(tempId);
      selectNote(tempId);
      if (bp === "mobile") setMobileView("editor");
      posthog.capture("note_created", { note_id: tempId, timestamp: new Date().toISOString() });
      return;
    }
    createNoteMut.mutate({
      data: {
        title: "Untitled Note",
        content: "<p></p>",
        folderId: activeFilter === "folder" && !isFolderSmart ? activeFolderId : null
      }
    });
  };

  const handleContextMenu = (e: React.MouseEvent, note: typeof notes[0]) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({
      noteId: note.id, pinned: note.pinned, favorite: note.favorite,
      vaulted: note.vaulted, tags: note.tags ?? [], x: e.clientX, y: e.clientY
    });
    setMoveMenuNoteId(null);
    setShowTagsPanel(false);
    setTagInput("");
  };

  const closeContextMenu = () => {
    setContextMenu(null); setMoveMenuNoteId(null); setShowTagsPanel(false); setTagInput("");
  };

  // Helper: update a single note's cache in demo mode
  const demoPatchNote = (noteId: number, patch: Record<string, unknown>) => {
    const existing = queryClient.getQueryData(getGetNoteQueryKey(noteId)) as Record<string, unknown> | undefined;
    if (existing) queryClient.setQueryData(getGetNoteQueryKey(noteId), { ...existing, ...patch });
  };

  const moveNote = (noteId: number, folderId: number | null) => {
    if (isDemo) {
      demoPatchNote(noteId, { folderId });
    } else {
      authenticatedFetch(`/api/notes/${noteId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId })
      }).then(() => queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() }));
    }
    closeContextMenu();
  };

  const addTagToNote = () => {
    if (!contextMenu) return;
    const tag = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!tag || contextMenu.tags.includes(tag)) { setTagInput(""); return; }
    const newTags = [...contextMenu.tags, tag];
    setContextMenu(prev => prev ? { ...prev, tags: newTags } : null);
    if (isDemo) {
      demoPatchNote(contextMenu.noteId, { tags: newTags });
    } else {
      updateNoteMut.mutate({ id: contextMenu.noteId, data: { tags: newTags } });
    }
    setTagInput("");
  };

  const removeTagFromNote = (tag: string) => {
    if (!contextMenu) return;
    const newTags = contextMenu.tags.filter(t => t !== tag);
    setContextMenu(prev => prev ? { ...prev, tags: newTags } : null);
    if (isDemo) {
      demoPatchNote(contextMenu.noteId, { tags: newTags });
    } else {
      updateNoteMut.mutate({ id: contextMenu.noteId, data: { tags: newTags } });
    }
  };

  const listTitle = {
    all: "All Notes",
    pinned: "All Notes",
    favorites: "Favorites",
    folder: activeFolder?.name || "Folder",
    tag: `#${activeTag}`,
    attachments: "Attachments",
    vault: "Vault",
    quickbits: "Quick Bits",
    "recently-deleted": "Recently Deleted",
  }[activeFilter] || "Notes";

  const currentSort = SORT_OPTIONS.find(o => o.sortBy === sortBy && o.sortDir === sortDir);

  const clampMenuStyle = (x: number, y: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuW = 220;
    const menuH = 300;
    const pad = 8;
    return {
      top: Math.min(y, vh - menuH - pad),
      left: Math.min(Math.max(x, pad), vw - menuW - pad),
    };
  };

  const containerClass = bp === "mobile"
    ? "flex-1 bg-background flex flex-col h-screen"
    : "border-r border-panel-border bg-background flex flex-col h-screen w-full";

  return (
    <div data-testid="note-list" className={containerClass}>
      {/* Header */}
      <div className="p-4 border-b border-panel-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {bp !== "desktop" && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="min-w-[44px] min-h-[44px] -ml-1 mr-1 rounded-lg hover:bg-panel transition-colors flex items-center justify-center"
              >
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            {bp === "desktop" && !isSidebarOpen && (
              <IconButton onClick={toggleSidebar} title="Show sidebar">
                <PanelLeft className="w-4 h-4" />
              </IconButton>
            )}
            <h2 className="text-lg font-semibold tracking-tight whitespace-nowrap">{listTitle}</h2>
            {isFolderSmart && (
              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">smart</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <IconButton onClick={() => setViewMode(viewMode === "list" ? "gallery" : "list")} title={viewMode === "list" ? "Gallery view" : "List view"}>
              {viewMode === "list" ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </IconButton>
            {/* Sort menu */}
            <div className="relative" ref={sortMenuRef}>
              <IconButton onClick={() => setShowSortMenu(!showSortMenu)} title="Sort" active={showSortMenu}>
                <SortAsc className="w-4 h-4" />
              </IconButton>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 z-40 min-w-[210px] bg-popover border border-panel-border rounded-lg shadow-xl py-1">
                  <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Sort by</p>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={`${opt.sortBy}-${opt.sortDir}`}
                      onClick={() => { setSort(opt.sortBy, opt.sortDir); setShowSortMenu(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors rounded-md",
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
            {/* New note — split primary + chevron zone */}
            <div className="relative" ref={plusMenuRef}>
              {bp !== "mobile" ? (
                /* Desktop: split button with chevron */
                <button
                  ref={plusBtnRef}
                  data-testid="new-note-btn"
                  disabled={createNoteMut.isPending}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    const chevronZoneStart = rect.right - rect.width * 0.3;
                    if (e.clientX >= chevronZoneStart) {
                      e.preventDefault();
                      setShowPlusMenu(v => !v);
                    } else {
                      handleCreateNew();
                    }
                  }}
                  className="flex items-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50 overflow-hidden h-9 active-elevate-2 transition-colors"
                  aria-label="New note or choose from template"
                >
                  <span className="flex items-center justify-center px-2.5 h-full">
                    <Plus className="w-4 h-4" />
                  </span>
                  <span className="w-px h-5 bg-white/25 shrink-0" />
                  <span className="flex items-center justify-center px-2 h-full hover:bg-white/8">
                    <motion.span
                      animate={{ rotate: showPlusMenu ? 180 : 0 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <ChevronDown className="w-2.5 h-2.5" />
                    </motion.span>
                  </span>
                </button>
              ) : (
                /* Mobile: simple + button, long-press opens sheet */
                <button
                  ref={plusBtnRef}
                  data-testid="new-note-btn"
                  disabled={createNoteMut.isPending}
                  onPointerDown={() => {
                    longPressTimer.current = setTimeout(() => {
                      const box = plusBtnRef.current?.getBoundingClientRect();
                      if (box) setPlusMenuPos({ bottom: box.bottom, right: box.right });
                      setShowPlusMenu(true);
                    }, 400);
                  }}
                  onPointerUp={() => {
                    if (longPressTimer.current) {
                      clearTimeout(longPressTimer.current);
                      longPressTimer.current = null;
                      if (!showPlusMenu) handleCreateNew();
                    }
                  }}
                  onPointerLeave={() => {
                    if (longPressTimer.current) {
                      clearTimeout(longPressTimer.current);
                      longPressTimer.current = null;
                    }
                  }}
                  className="p-2 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50 flex items-center justify-center active-elevate-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

              {/* Desktop dropdown */}
              {bp !== "mobile" && showPlusMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] bg-popover border border-panel-border rounded-lg shadow-md py-2 luminance-border-top"
                  data-testid="new-note-dropdown"
                >
                  <button
                    data-testid="from-template-btn"
                    onClick={() => { setShowPlusMenu(false); openTemplatePicker("note"); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-foreground hover:bg-panel rounded-md transition-colors"
                  >
                    <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
                    From template
                  </button>
                  <button
                    onClick={() => { setShowPlusMenu(false); setFilter("quickbits"); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-foreground hover:bg-panel rounded-md transition-colors"
                  >
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    New Quick Bit instead
                  </button>
                </div>
              )}

              {/* Mobile anchored popover — pops out of the + button, Framer Motion animated */}
              {bp === "mobile" && typeof window !== "undefined" && ReactDOM.createPortal(
                <AnimatePresence>
                  {showPlusMenu && plusMenuPos && (
                    <>
                      <motion.div
                        key="note-plus-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={anim.fastTransition}
                        className="fixed inset-0 z-40"
                        onClick={() => setShowPlusMenu(false)}
                      />
                      <motion.div
                        key="note-plus-menu"
                        initial={anim.useScale ? { opacity: 0, scale: 0.88 } : { opacity: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={anim.useScale ? { opacity: 0, scale: 0.88 } : { opacity: 0 }}
                        transition={anim.fastTransition}
                        className="fixed z-50 bg-[var(--color-surface-3,var(--color-panel))] border border-panel-border rounded-xl shadow-lg overflow-hidden w-52"
                        style={{
                          top: plusMenuPos.bottom + 6,
                          right: window.innerWidth - plusMenuPos.right,
                          transformOrigin: "top right",
                        }}
                      >
                        <button
                          onClick={() => { setShowPlusMenu(false); openTemplatePicker("note"); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-foreground hover:bg-panel transition-colors"
                        >
                          <LayoutTemplate className="w-4 h-4 text-muted-foreground shrink-0" />
                          From template
                        </button>
                        <div className="h-px bg-panel-border mx-3" />
                        <button
                          onClick={() => { setShowPlusMenu(false); setFilter("quickbits"); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-foreground hover:bg-panel transition-colors"
                        >
                          <Zap className="w-4 h-4 text-muted-foreground shrink-0" />
                          New Quick Bit instead
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>,
                document.body
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notes..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            data-testid="note-search-input"
            className="w-full bg-panel border border-panel-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground h-full">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">No notes found.</p>
            {debouncedSearch && <p className="text-xs mt-1 opacity-70">Try a different search term.</p>}
          </div>
        ) : viewMode === "gallery" ? (
          /* Inner grid wrapper — keeping the grid separate from the overflow container
             fixes Chrome's min-content row sizing that occurs when grid + overflow-y:auto
             share the same element with a definite height. */
          <div className="grid grid-cols-2 gap-2">
          <AnimatePresence initial={false}>
          {notes.map(note => {
            const img = getFirstImage(note.content);
            return (
              <motion.div
                key={note.id}
                data-testid="note-item"
                layout
                initial={anim.initialVariants}
                animate={anim.enterVariants}
                exit={anim.cardExitVariants}
                transition={anim.fastTransition}
                style={anim.cardExitStyle}
                onClick={() => handleSelectNote(note.id)}
                onContextMenu={e => handleContextMenu(e, note)}
                className={cn(
                  "rounded-lg cursor-pointer border transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] group overflow-hidden",
                  anim.useScale && "hover:-translate-y-0.5 active:scale-[0.98]",
                  selectedNoteId === note.id
                    ? "bg-primary/10 border-primary/30 shadow-sm"
                    : "bg-card border-transparent hover:bg-panel-hover hover:border-panel-border"
                )}
              >
                {img && (
                  <div className="w-full h-24 overflow-hidden bg-panel">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-2.5 flex flex-col">
                  <div className="flex items-start justify-between mb-1 gap-1">
                    <h3 className="font-semibold text-sm text-foreground/90 flex-1 min-w-0 line-clamp-2 leading-snug">
                      {note.pinned && <Pin className="inline-block w-2.5 h-2.5 mr-0.5 text-primary fill-primary align-text-bottom" />}
                      {note.vaulted && <ShieldCheck className="inline-block w-2.5 h-2.5 mr-0.5 text-indigo-400 align-text-bottom" />}
                      {note.title || "Untitled Note"}
                    </h3>
                    {/* Smaller touch target in gallery cards — 44px is too large for a narrow card */}
                    <button
                      onClick={e => { e.stopPropagation(); handleContextMenu(e, note); }}
                      className={cn(
                        "rounded-md hover:bg-panel-border transition-all shrink-0 self-start",
                        bp === "desktop" ? "opacity-0 group-hover:opacity-100 p-0.5" : "opacity-60 p-1"
                      )}
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {note.vaulted ? "🔒 Vault note" : (note.contentText || "No content")}
                  </p>
                  <div className="flex items-center justify-between pt-1.5 gap-1">
                    <span className="text-xs text-muted-foreground/70 font-mono">{formatDate(note.updatedAt)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {note.favorite && <Star className="w-3 h-3 fill-current text-yellow-500" />}
                      {img && <ImageIcon className="w-2.5 h-2.5 text-muted-foreground opacity-60" />}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-1">
          <AnimatePresence initial={false}>
          {notes.map(note => (
            <motion.div
              key={note.id}
              data-testid="note-item"
              layout
              initial={anim.initialVariants}
              animate={anim.enterVariants}
              exit={anim.cardExitVariants}
              transition={anim.fastTransition}
              style={anim.cardExitStyle}
              onClick={() => handleSelectNote(note.id)}
              onContextMenu={e => handleContextMenu(e, note)}
              className={cn(
                "p-3 rounded-lg cursor-pointer transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] group relative h-[88px] flex flex-col",
                anim.useScale && "hover:-translate-y-[1px] active:scale-[0.98]",
                selectedNoteId === note.id
                  ? "bg-primary/10 border-l-2 border-l-primary border-y border-y-transparent border-r border-r-transparent"
                  : "bg-card border-l-2 border-l-transparent border-y border-y-transparent border-r border-r-transparent hover:bg-panel-hover"
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className={cn(
                  "font-semibold truncate pr-2 text-sm flex items-center gap-1.5",
                  selectedNoteId === note.id ? "text-foreground" : "text-foreground/90"
                )}>
                  {note.pinned && <Pin className="w-3 h-3 shrink-0 text-primary fill-primary" />}
                  {note.vaulted && <ShieldCheck className="w-3 h-3 shrink-0 text-indigo-400" />}
                  {note.title || "Untitled Note"}
                </h3>
                <div className="flex items-center gap-1 shrink-0">
                  {note.favorite && <Star className="w-3 h-3 fill-current text-yellow-500 opacity-70" />}
                  <button
                    onClick={e => { e.stopPropagation(); handleContextMenu(e, note); }}
                    className={cn("rounded-md hover:bg-panel-border transition-all", bp === "desktop" ? "opacity-0 group-hover:opacity-100 p-0.5" : "opacity-70 min-w-[44px] min-h-[44px] flex items-center justify-center p-2")}
                    title="Options"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                {note.vaulted ? "🔒 Vault note" : (note.contentText || "No content")}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-muted-foreground/70 font-mono">{formatDate(note.updatedAt)}</span>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex gap-1 overflow-hidden">
                    {note.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15 truncate max-w-[60px]">
                        #{tag}
                      </span>
                    ))}
                    {note.tags.length > 2 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-panel text-muted-foreground">+{note.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[200px] bg-popover text-popover-foreground border border-panel-border rounded-xl shadow-2xl shadow-black/40 py-1 overflow-visible backdrop-blur-none luminance-border-top"
          style={clampMenuStyle(contextMenu.x, contextMenu.y)}
        >
          <ContextMenuItem
            icon={<Pin className={cn("w-4 h-4", contextMenu.pinned && "fill-current text-primary")} />}
            label={contextMenu.pinned ? "Unpin" : "Pin to top"}
            onClick={() => {
              if (isDemo) { demoPatchNote(contextMenu.noteId, { pinned: !contextMenu.pinned }); }
              else { pinMut.mutate({ id: contextMenu.noteId }); }
              closeContextMenu();
            }}
          />
          <ContextMenuItem
            icon={<Star className={cn("w-4 h-4", contextMenu.favorite && "fill-current text-yellow-500")} />}
            label={contextMenu.favorite ? "Remove Favorite" : "Add to Favorites"}
            onClick={() => {
              if (isDemo) { demoPatchNote(contextMenu.noteId, { favorite: !contextMenu.favorite }); }
              else { favMut.mutate({ id: contextMenu.noteId }); }
              closeContextMenu();
            }}
          />

          <div className="h-px bg-panel-border mx-2 my-1" />

          {/* Tags panel */}
          <ContextMenuItem
            icon={<Tag className="w-4 h-4" />}
            label="Edit tags"
            chevron={!showTagsPanel}
            active={showTagsPanel}
            onClick={() => {
              setShowTagsPanel(!showTagsPanel);
              setMoveMenuNoteId(null);
              if (!showTagsPanel) setTimeout(() => tagInputRef.current?.focus(), 50);
            }}
          />
          {showTagsPanel && (
            <div className="px-2 pb-2 pt-1 space-y-2">
              {contextMenu.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contextMenu.tags.map(tag => (
                    <span key={tag} className="group/tag flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20">
                      <Hash className="w-2 h-2" />
                      {tag}
                      <button onClick={() => removeTagFromNote(tag)} className="ml-0.5 hover:text-destructive transition-colors">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Hash className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={tagInputRef}
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTagToNote(); } e.stopPropagation(); }}
                    placeholder="Add tag..."
                    className="w-full bg-background border border-panel-border rounded-lg pl-6 pr-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                  />
                </div>
                <button
                  onClick={addTagToNote}
                  className="px-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {folders.length > 0 && (
            <>
              <div className="h-px bg-panel-border mx-2 my-1" />
              <div className="relative">
                <ContextMenuItem
                  icon={<FolderInput className="w-4 h-4" />}
                  label="Move to folder"
                  chevron={moveMenuNoteId !== contextMenu.noteId}
                  active={moveMenuNoteId === contextMenu.noteId}
                  onClick={() => { setMoveMenuNoteId(moveMenuNoteId === contextMenu.noteId ? null : contextMenu.noteId); setShowTagsPanel(false); }}
                />
                {moveMenuNoteId === contextMenu.noteId && (
                  <div className={cn("absolute top-0 min-w-[150px] bg-popover text-popover-foreground border border-panel-border rounded-xl shadow-2xl shadow-black/40 py-1 z-50 luminance-border-top", contextMenu.x > window.innerWidth / 2 ? "right-full mr-1" : "left-full ml-1")}>
                    <ContextMenuItem icon={<FileText className="w-4 h-4" />} label="No folder" onClick={() => moveNote(contextMenu.noteId, null)} />
                    {folders.map(f => (
                      <ContextMenuItem key={f.id} icon={<FileText className="w-4 h-4" />} label={f.name} onClick={() => moveNote(contextMenu.noteId, f.id)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {isVaultUnlocked && (
            <>
              <div className="h-px bg-panel-border mx-2 my-1" />
              <ContextMenuItem
                icon={<ShieldCheck className={cn("w-4 h-4", contextMenu.vaulted && "text-indigo-400")} />}
                label={contextMenu.vaulted ? "Remove from Vault" : "Move to Vault"}
                testId="context-menu-vault"
                onClick={() => {
                  if (isDemo) { demoPatchNote(contextMenu.noteId, { vaulted: !contextMenu.vaulted }); }
                  else { vaultMut.mutate({ id: contextMenu.noteId, data: { vaulted: !contextMenu.vaulted } }); }
                  closeContextMenu();
                }}
              />
            </>
          )}

          <div className="h-px bg-panel-border mx-2 my-1" />
          <ContextMenuItem
            icon={<Trash2 className="w-4 h-4" />}
            label="Delete"
            danger
            testId="context-menu-delete"
            onClick={() => {
              if (isDemo) {
                const now = new Date().toISOString();
                const autoDeleteAt = new Date(Date.now() + 30 * 86400000).toISOString();
                demoPatchNote(contextMenu.noteId, {
                  _demoDeleted: true,
                  deletedAt: now,
                  autoDeleteAt,
                  deletedReason: "deleted",
                });
                posthog.capture("note_deleted", { note_id: contextMenu.noteId, timestamp: now });
                if (selectedNoteId === contextMenu.noteId) { selectNote(null); }
              } else {
                softDeleteMut.mutate({ id: contextMenu.noteId });
              }
              closeContextMenu();
            }}
          />
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({
  icon, label, onClick, danger, chevron, active, testId
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
  danger?: boolean; chevron?: boolean; active?: boolean; testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : active
            ? "text-primary bg-primary/10"
            : "text-foreground hover:bg-panel"
      )}
    >
      <span className="opacity-70">{icon}</span>
      <span className="flex-1">{label}</span>
      {chevron && <span className="opacity-40 text-xs">›</span>}
    </button>
  );
}
