import AsyncStorage from "@react-native-async-storage/async-storage";
import { offlineDb } from "./database";
import type { Note, Folder, SmartFolder } from "./api";

const SETTINGS_PREFIX = "settings_";

export const cache = {
  async getNotes(options?: {
    folderId?: string;
    tag?: string;
    sortBy?: string;
    sortDir?: string;
  }): Promise<Note[] | null> {
    try {
      return await offlineDb.getNotes(options);
    } catch (error) {
      console.warn("SQLite getNotes failed, falling back:", error);
      return null;
    }
  },

  async setNotes(notes: Note[]): Promise<void> {
    try {
      await offlineDb.saveNotes(notes);
    } catch (error) {
      console.warn("SQLite saveNotes failed:", error);
    }
  },

  async getNote(id: number): Promise<Note | null> {
    try {
      return await offlineDb.getNote(id);
    } catch (error) {
      console.warn("SQLite getNote failed:", error);
      return null;
    }
  },

  async updateNoteInCache(updatedNote: Note): Promise<void> {
    try {
      await offlineDb.saveNote(updatedNote);
    } catch (error) {
      console.warn("SQLite updateNote failed:", error);
    }
  },

  async removeNoteFromCache(id: number): Promise<void> {
    try {
      await offlineDb.deleteNote(id);
    } catch (error) {
      console.warn("SQLite deleteNote failed:", error);
    }
  },

  async getFolders(): Promise<Folder[] | null> {
    try {
      const folders = await offlineDb.getFolders();
      return folders.length > 0 ? folders : null;
    } catch (error) {
      console.warn("SQLite getFolders failed:", error);
      return null;
    }
  },

  async setFolders(folders: Folder[]): Promise<void> {
    try {
      await offlineDb.saveFolders(folders);
    } catch (error) {
      console.warn("SQLite saveFolders failed:", error);
    }
  },

  async getSmartFolders(): Promise<SmartFolder[] | null> {
    try {
      const folders = await offlineDb.getSmartFolders();
      return folders.length > 0 ? folders : null;
    } catch (error) {
      console.warn("SQLite getSmartFolders failed:", error);
      return null;
    }
  },

  async setSmartFolders(folders: SmartFolder[]): Promise<void> {
    try {
      await offlineDb.saveSmartFolders(folders);
    } catch (error) {
      console.warn("SQLite saveSmartFolders failed:", error);
    }
  },

  async getLastSync(): Promise<string | null> {
    try {
      return await offlineDb.getLastSync();
    } catch (error) {
      console.warn("SQLite getLastSync failed:", error);
      return null;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await offlineDb.clearAll();
    } catch (error) {
      console.warn("SQLite clearAll failed:", error);
    }
  },
};

export const settingsStore = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SETTINGS_PREFIX + key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_PREFIX + key, value);
    } catch (error) {
      console.warn("Settings store set failed:", error);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(SETTINGS_PREFIX + key);
    } catch (error) {
      console.warn("Settings store remove failed:", error);
    }
  },

  async getAIConfig(): Promise<{
    provider: string;
    apiKey: string;
    model: string;
  }> {
    const provider = (await this.get("ai_provider")) || "anthropic";
    const apiKey = (await this.get("ai_api_key")) || "";
    const model = (await this.get("ai_model")) || "claude-sonnet-4-6";
    return { provider, apiKey, model };
  },

  async setAIConfig(config: {
    provider: string;
    apiKey: string;
    model: string;
  }): Promise<void> {
    await this.set("ai_provider", config.provider);
    await this.set("ai_api_key", config.apiKey);
    await this.set("ai_model", config.model);
  },
};
