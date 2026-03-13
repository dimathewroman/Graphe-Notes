import type { Note, Folder, SmartFolder } from "./api";

let notesStore: Note[] = [];
let foldersStore: Folder[] = [];
let smartFoldersStore: SmartFolder[] = [];
let syncMeta: Record<string, string> = {};

export const offlineDb = {
  async saveNotes(notes: Note[]): Promise<void> {
    notesStore = [...notes];
    syncMeta["last_notes_sync"] = new Date().toISOString();
  },

  async getNotes(options?: {
    folderId?: string;
    tag?: string;
    sortBy?: string;
    sortDir?: string;
  }): Promise<Note[]> {
    let filtered = [...notesStore];

    if (options?.folderId) {
      filtered = filtered.filter((n) => String(n.folderId) === options.folderId);
    }
    if (options?.tag) {
      filtered = filtered.filter((n) => n.tags?.includes(options.tag!));
    }

    const sortCol = options?.sortBy === "title" ? "title" : "updatedAt";
    const dir = options?.sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const aVal = a[sortCol] || "";
      const bVal = b[sortCol] || "";
      return aVal < bVal ? -dir : aVal > bVal ? dir : 0;
    });

    return filtered;
  },

  async getNote(id: number): Promise<Note | null> {
    return notesStore.find((n) => n.id === id) || null;
  },

  async saveNote(note: Note): Promise<void> {
    const idx = notesStore.findIndex((n) => n.id === note.id);
    if (idx >= 0) {
      notesStore[idx] = note;
    } else {
      notesStore.push(note);
    }
  },

  async deleteNote(id: number): Promise<void> {
    notesStore = notesStore.filter((n) => n.id !== id);
  },

  async saveFolders(folders: Folder[]): Promise<void> {
    foldersStore = [...folders];
  },

  async getFolders(): Promise<Folder[]> {
    return [...foldersStore];
  },

  async saveSmartFolders(folders: SmartFolder[]): Promise<void> {
    smartFoldersStore = [...folders];
  },

  async getSmartFolders(): Promise<SmartFolder[]> {
    return [...smartFoldersStore];
  },

  async enqueueWrite(_operation: string, _endpoint: string, _payload: unknown): Promise<void> {},

  async getWriteQueue(): Promise<Array<{
    id: number;
    operation: string;
    endpoint: string;
    payload: unknown;
  }>> {
    return [];
  },

  async removeFromQueue(_id: number): Promise<void> {},

  async getLastSync(): Promise<string | null> {
    return syncMeta["last_notes_sync"] || null;
  },

  async clearAll(): Promise<void> {
    notesStore = [];
    foldersStore = [];
    smartFoldersStore = [];
    syncMeta = {};
  },
};
