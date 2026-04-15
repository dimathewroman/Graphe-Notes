import { create } from "zustand";
import type { GetNotesSortBy, GetNotesSortDir } from "@workspace/api-client-react";

type FilterType = "all" | "pinned" | "favorites" | "folder" | "tag" | "attachments" | "vault" | "quickbits" | "recently-deleted";
type ViewMode = "list" | "gallery";
type MobileView = "list" | "editor";
type SettingsTab = "appearance" | "ai" | "data" | "security" | "quickbits" | "account";
export type MotionLevel = "full" | "reduced" | "minimal";

interface AppState {
  activeFilter: FilterType;
  activeFolderId: number | null;
  activeTag: string | null;
  searchQuery: string;
  sortBy: GetNotesSortBy;
  sortDir: GetNotesSortDir;
  viewMode: ViewMode;

  motionLevel: MotionLevel;
  setMotionLevel: (level: MotionLevel) => void;

  selectedNoteId: number | null;
  selectedQuickBitId: number | null;
  mobileView: MobileView;

  isSidebarOpen: boolean;
  isNoteListOpen: boolean;
  isAIPanelOpen: boolean;
  isSettingsOpen: boolean;
  settingsInitialTab: SettingsTab | null;

  sidebarWidth: number;
  noteListWidth: number;
  setSidebarWidth: (w: number) => void;
  setNoteListWidth: (w: number) => void;

  isVaultUnlocked: boolean;
  setVaultUnlocked: (isUnlocked: boolean) => void;

  isAiSetupModalOpen: boolean;
  pendingAiAction: ((provider: string) => Promise<void>) | null;
  setAiSetupModalOpen: (isOpen: boolean) => void;
  setPendingAiAction: (action: ((provider: string) => Promise<void>) | null) => void;

  demoExtraIds: number[];
  addDemoNoteId: (id: number) => void;
  resetDemoNoteIds: () => void;

  setFilter: (filter: FilterType, idOrTag?: number | string | null) => void;
  setSearchQuery: (query: string) => void;
  setSort: (by: GetNotesSortBy, dir: GetNotesSortDir) => void;
  setViewMode: (mode: ViewMode) => void;
  selectNote: (id: number | null) => void;
  selectQuickBit: (id: number | null) => void;
  setMobileView: (view: MobileView) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleNoteList: () => void;
  setNoteListOpen: (isOpen: boolean) => void;
  setAIPanelOpen: (isOpen: boolean) => void;
  setSettingsOpen: (isOpen: boolean, tab?: SettingsTab) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeFilter: "quickbits",
  activeFolderId: null,
  activeTag: null,
  searchQuery: "",
  sortBy: "updatedAt",
  sortDir: "desc",
  viewMode: "list",

  motionLevel: "full",
  setMotionLevel: (level) => set({ motionLevel: level }),

  selectedNoteId: null,
  selectedQuickBitId: null,
  mobileView: "list",

  isSidebarOpen: true,
  isNoteListOpen: true,
  isAIPanelOpen: false,
  isSettingsOpen: false,
  settingsInitialTab: null,

  sidebarWidth: 240,
  noteListWidth: 340,
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setNoteListWidth: (w) => set({ noteListWidth: w }),

  isVaultUnlocked: false,
  setVaultUnlocked: (isUnlocked) => set({ isVaultUnlocked: isUnlocked }),

  isAiSetupModalOpen: false,
  pendingAiAction: null,
  setAiSetupModalOpen: (isOpen) => set({ isAiSetupModalOpen: isOpen }),
  setPendingAiAction: (action) => set({ pendingAiAction: action }),

  demoExtraIds: [],
  addDemoNoteId: (id) => set((state) => ({ demoExtraIds: [...state.demoExtraIds, id] })),
  resetDemoNoteIds: () => set({ demoExtraIds: [] }),

  setFilter: (filter, idOrTag) => set({
    activeFilter: filter,
    activeFolderId: filter === "folder" && typeof idOrTag === "number" ? idOrTag : null,
    activeTag: filter === "tag" && typeof idOrTag === "string" ? idOrTag : null,
    selectedNoteId: null,
    mobileView: "list",
  }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSort: (by, dir) => set({ sortBy: by, sortDir: dir }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectNote: (id) => set({ selectedNoteId: id }),
  selectQuickBit: (id) => set({ selectedQuickBitId: id }),
  setMobileView: (view) => set({ mobileView: view }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  toggleNoteList: () => set((state) => ({ isNoteListOpen: !state.isNoteListOpen })),
  setNoteListOpen: (isOpen) => set({ isNoteListOpen: isOpen }),
  setAIPanelOpen: (isOpen) => set({ isAIPanelOpen: isOpen }),
  setSettingsOpen: (isOpen, tab) => set({ isSettingsOpen: isOpen, settingsInitialTab: tab ?? null }),
}));
