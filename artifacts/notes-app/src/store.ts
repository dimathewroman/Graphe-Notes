import { create } from "zustand";
import type { GetNotesSortBy, GetNotesSortDir } from "@workspace/api-client-react";

type FilterType = "all" | "pinned" | "favorites" | "folder" | "tag";

interface AppState {
  // Navigation State
  activeFilter: FilterType;
  activeFolderId: number | null;
  activeTag: string | null;
  searchQuery: string;
  sortBy: GetNotesSortBy;
  sortDir: GetNotesSortDir;
  
  // Selection State
  selectedNoteId: number | null;
  
  // UI Panels
  isSidebarOpen: boolean;
  isAIPanelOpen: boolean;
  isSettingsOpen: boolean;
  
  // Actions
  setFilter: (filter: FilterType, idOrTag?: number | string | null) => void;
  setSearchQuery: (query: string) => void;
  setSort: (by: GetNotesSortBy, dir: GetNotesSortDir) => void;
  selectNote: (id: number | null) => void;
  toggleSidebar: () => void;
  setAIPanelOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeFilter: "all",
  activeFolderId: null,
  activeTag: null,
  searchQuery: "",
  sortBy: "updatedAt",
  sortDir: "desc",
  
  selectedNoteId: null,
  
  isSidebarOpen: true,
  isAIPanelOpen: false,
  isSettingsOpen: false,
  
  setFilter: (filter, idOrTag) => set({ 
    activeFilter: filter, 
    activeFolderId: filter === "folder" && typeof idOrTag === 'number' ? idOrTag : null,
    activeTag: filter === "tag" && typeof idOrTag === 'string' ? idOrTag : null,
    selectedNoteId: null // Reset selection on nav change
  }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSort: (by, dir) => set({ sortBy: by, sortDir: dir }),
  selectNote: (id) => set({ selectedNoteId: id }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setAIPanelOpen: (isOpen) => set({ isAIPanelOpen: isOpen }),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
}));
