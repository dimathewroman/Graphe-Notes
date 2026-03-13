import * as SQLite from "expo-sqlite";
import type { Note, Folder, SmartFolder } from "./api";

const DB_NAME = "notes_offline.db";

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await initSchema(db);
  }
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT DEFAULT '',
      contentText TEXT DEFAULT '',
      folderId INTEGER,
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      lockPasswordHash TEXT,
      coverImage TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      parentId INTEGER,
      color TEXT,
      icon TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS smart_folders (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      filters TEXT DEFAULT '{}',
      icon TEXT,
      noteCount INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS write_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function noteToRow(note: Note): Record<string, unknown> {
  return {
    $id: note.id,
    $title: note.title || "",
    $content: note.content || "",
    $contentText: note.contentText || "",
    $folderId: note.folderId ?? null,
    $tags: JSON.stringify(note.tags || []),
    $pinned: note.pinned ? 1 : 0,
    $favorite: note.favorite ? 1 : 0,
    $locked: note.locked ? 1 : 0,
    $lockPasswordHash: note.lockPasswordHash ?? null,
    $coverImage: note.coverImage ?? null,
    $createdAt: note.createdAt,
    $updatedAt: note.updatedAt,
  };
}

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as number,
    title: (row.title as string) || "",
    content: (row.content as string) || "",
    contentText: (row.contentText as string) || "",
    folderId: row.folderId as number | null,
    tags: JSON.parse((row.tags as string) || "[]"),
    pinned: Boolean(row.pinned),
    favorite: Boolean(row.favorite),
    locked: Boolean(row.locked),
    lockPasswordHash: (row.lockPasswordHash as string) || null,
    coverImage: (row.coverImage as string) || null,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function rowToFolder(row: Record<string, unknown>): Folder {
  return {
    id: row.id as number,
    name: (row.name as string) || "",
    parentId: row.parentId as number | null,
    color: row.color as string | null,
    icon: row.icon as string | null,
    sortOrder: row.sortOrder as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

export const offlineDb = {
  async saveNotes(notes: Note[]): Promise<void> {
    const database = await getDb();
    await database.execAsync("DELETE FROM notes");
    for (const note of notes) {
      const params = noteToRow(note);
      await database.runAsync(
        `INSERT OR REPLACE INTO notes (id, title, content, contentText, folderId, tags, pinned, favorite, locked, lockPasswordHash, coverImage, createdAt, updatedAt)
         VALUES ($id, $title, $content, $contentText, $folderId, $tags, $pinned, $favorite, $locked, $lockPasswordHash, $coverImage, $createdAt, $updatedAt)`,
        params
      );
    }
    await database.runAsync(
      "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ($key, $value)",
      { $key: "last_notes_sync", $value: new Date().toISOString() }
    );
  },

  async getNotes(options?: {
    folderId?: string;
    tag?: string;
    sortBy?: string;
    sortDir?: string;
  }): Promise<Note[]> {
    const database = await getDb();
    let sql = "SELECT * FROM notes WHERE 1=1";
    const params: Record<string, unknown> = {};

    if (options?.folderId) {
      sql += " AND folderId = $folderId";
      params.$folderId = Number(options.folderId);
    }

    const sortCol = options?.sortBy === "title" ? "title" : "updatedAt";
    const sortDirection = options?.sortDir === "asc" ? "ASC" : "DESC";
    sql += ` ORDER BY pinned DESC, ${sortCol} ${sortDirection}`;

    const rows = await database.getAllAsync(sql, params);
    let notes = (rows as Record<string, unknown>[]).map(rowToNote);

    if (options?.tag) {
      notes = notes.filter((n) => n.tags?.includes(options.tag!));
    }

    return notes;
  },

  async getNote(id: number): Promise<Note | null> {
    const database = await getDb();
    const row = await database.getFirstAsync("SELECT * FROM notes WHERE id = $id", { $id: id });
    return row ? rowToNote(row as Record<string, unknown>) : null;
  },

  async saveNote(note: Note): Promise<void> {
    const database = await getDb();
    const params = noteToRow(note);
    await database.runAsync(
      `INSERT OR REPLACE INTO notes (id, title, content, contentText, folderId, tags, pinned, favorite, locked, lockPasswordHash, coverImage, createdAt, updatedAt)
       VALUES ($id, $title, $content, $contentText, $folderId, $tags, $pinned, $favorite, $locked, $lockPasswordHash, $coverImage, $createdAt, $updatedAt)`,
      params
    );
  },

  async deleteNote(id: number): Promise<void> {
    const database = await getDb();
    await database.runAsync("DELETE FROM notes WHERE id = $id", { $id: id });
  },

  async saveFolders(folders: Folder[]): Promise<void> {
    const database = await getDb();
    await database.execAsync("DELETE FROM folders");
    for (const folder of folders) {
      await database.runAsync(
        `INSERT OR REPLACE INTO folders (id, name, parentId, color, icon, sortOrder, createdAt, updatedAt)
         VALUES ($id, $name, $parentId, $color, $icon, $sortOrder, $createdAt, $updatedAt)`,
        {
          $id: folder.id,
          $name: folder.name,
          $parentId: folder.parentId ?? null,
          $color: folder.color ?? null,
          $icon: folder.icon ?? null,
          $sortOrder: folder.sortOrder ?? 0,
          $createdAt: folder.createdAt,
          $updatedAt: folder.updatedAt,
        }
      );
    }
  },

  async getFolders(): Promise<Folder[]> {
    const database = await getDb();
    const rows = await database.getAllAsync("SELECT * FROM folders ORDER BY sortOrder ASC");
    return (rows as Record<string, unknown>[]).map(rowToFolder);
  },

  async saveSmartFolders(folders: SmartFolder[]): Promise<void> {
    const database = await getDb();
    await database.execAsync("DELETE FROM smart_folders");
    for (const folder of folders) {
      await database.runAsync(
        `INSERT OR REPLACE INTO smart_folders (id, name, filters, icon, noteCount)
         VALUES ($id, $name, $filters, $icon, $noteCount)`,
        {
          $id: folder.id,
          $name: folder.name,
          $filters: JSON.stringify(folder.filters || {}),
          $icon: folder.icon ?? null,
          $noteCount: folder.noteCount ?? 0,
        }
      );
    }
  },

  async getSmartFolders(): Promise<SmartFolder[]> {
    const database = await getDb();
    const rows = await database.getAllAsync("SELECT * FROM smart_folders");
    return (rows as Record<string, unknown>[]).map((row) => ({
      id: row.id as number,
      name: (row.name as string) || "",
      filters: JSON.parse((row.filters as string) || "{}"),
      icon: row.icon as string | null,
      noteCount: row.noteCount as number,
    }));
  },

  async enqueueWrite(operation: string, endpoint: string, payload: unknown): Promise<void> {
    const database = await getDb();
    await database.runAsync(
      "INSERT INTO write_queue (operation, endpoint, payload, createdAt) VALUES ($operation, $endpoint, $payload, $createdAt)",
      {
        $operation: operation,
        $endpoint: endpoint,
        $payload: JSON.stringify(payload),
        $createdAt: new Date().toISOString(),
      }
    );
  },

  async getWriteQueue(): Promise<Array<{
    id: number;
    operation: string;
    endpoint: string;
    payload: unknown;
  }>> {
    const database = await getDb();
    const rows = await database.getAllAsync("SELECT * FROM write_queue ORDER BY id ASC");
    return (rows as Record<string, unknown>[]).map((row) => ({
      id: row.id as number,
      operation: row.operation as string,
      endpoint: row.endpoint as string,
      payload: JSON.parse(row.payload as string),
    }));
  },

  async removeFromQueue(id: number): Promise<void> {
    const database = await getDb();
    await database.runAsync("DELETE FROM write_queue WHERE id = $id", { $id: id });
  },

  async getLastSync(): Promise<string | null> {
    const database = await getDb();
    const row = await database.getFirstAsync("SELECT value FROM sync_meta WHERE key = $key", {
      $key: "last_notes_sync",
    });
    return row ? (row as Record<string, unknown>).value as string : null;
  },

  async clearAll(): Promise<void> {
    const database = await getDb();
    await database.execAsync(`
      DELETE FROM notes;
      DELETE FROM folders;
      DELETE FROM smart_folders;
      DELETE FROM write_queue;
      DELETE FROM sync_meta;
    `);
  },
};
