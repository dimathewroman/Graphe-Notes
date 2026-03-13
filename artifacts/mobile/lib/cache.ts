import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Note, Folder, SmartFolder } from "./api";

const KEYS = {
  notes: "cache_notes",
  folders: "cache_folders",
  smartFolders: "cache_smart_folders",
  tags: "cache_tags",
  lastSync: "cache_last_sync",
};

export const cache = {
  async getNotes(): Promise<Note[] | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.notes);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setNotes(notes: Note[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.notes, JSON.stringify(notes));
      await AsyncStorage.setItem(KEYS.lastSync, Date.now().toString());
    } catch {}
  },

  async getNote(id: number): Promise<Note | null> {
    const notes = await this.getNotes();
    return notes?.find((n) => n.id === id) ?? null;
  },

  async updateNoteInCache(updatedNote: Note): Promise<void> {
    const notes = await this.getNotes();
    if (!notes) return;
    const idx = notes.findIndex((n) => n.id === updatedNote.id);
    if (idx >= 0) {
      notes[idx] = updatedNote;
    } else {
      notes.unshift(updatedNote);
    }
    await this.setNotes(notes);
  },

  async removeNoteFromCache(id: number): Promise<void> {
    const notes = await this.getNotes();
    if (!notes) return;
    await this.setNotes(notes.filter((n) => n.id !== id));
  },

  async getFolders(): Promise<Folder[] | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.folders);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setFolders(folders: Folder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.folders, JSON.stringify(folders));
    } catch {}
  },

  async getSmartFolders(): Promise<SmartFolder[] | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.smartFolders);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setSmartFolders(folders: SmartFolder[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.smartFolders, JSON.stringify(folders));
    } catch {}
  },

  async getTags(): Promise<string[] | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.tags);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setTags(tags: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.tags, JSON.stringify(tags));
    } catch {}
  },

  async getLastSync(): Promise<number | null> {
    try {
      const ts = await AsyncStorage.getItem(KEYS.lastSync);
      return ts ? Number(ts) : null;
    } catch {
      return null;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
    } catch {}
  },
};
