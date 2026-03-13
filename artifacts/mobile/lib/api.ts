import { Platform } from "react-native";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  if (Platform.OS === "web") return "";
  return "http://localhost:8080";
}

const BASE_URL = getBaseUrl();

async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (response.status === 204) return null as T;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }
  return response.json() as Promise<T>;
}

export type Note = {
  id: number;
  title: string;
  content: string | null;
  contentText: string | null;
  folderId: number | null;
  pinned: boolean;
  favorite: boolean;
  locked: boolean;
  lockPasswordHash: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type SmartFolder = {
  id: number;
  name: string;
  tagRules: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type NoteVersion = {
  id: number;
  noteId: number;
  title: string;
  content: string;
  contentText: string | null;
  createdAt: string;
};

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const api = {
  getNotes: (params?: {
    folderId?: number | null;
    search?: string;
    pinned?: boolean;
    favorite?: boolean;
    tag?: string;
    sortBy?: string;
    sortDir?: string;
  }) => apiFetch<Note[]>(`/api/notes${qs(params ?? {})}`),

  getNote: (id: number) => apiFetch<Note>(`/api/notes/${id}`),

  createNote: (data: {
    title?: string;
    content?: string;
    folderId?: number | null;
    tags?: string[];
  }) =>
    apiFetch<Note>("/api/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateNote: (
    id: number,
    data: {
      title?: string;
      content?: string;
      contentText?: string;
      tags?: string[];
      folderId?: number | null;
    }
  ) =>
    apiFetch<Note>(`/api/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteNote: (id: number) =>
    apiFetch<void>(`/api/notes/${id}`, { method: "DELETE" }),

  togglePin: (id: number) =>
    apiFetch<Note>(`/api/notes/${id}/pin`, { method: "PATCH" }),

  toggleFavorite: (id: number) =>
    apiFetch<Note>(`/api/notes/${id}/favorite`, { method: "PATCH" }),

  moveNote: (id: number, folderId: number | null) =>
    apiFetch<Note>(`/api/notes/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ folderId }),
    }),

  lockNote: (id: number, passwordHash: string) =>
    apiFetch<Note>(`/api/notes/${id}/lock`, {
      method: "PATCH",
      body: JSON.stringify({ passwordHash }),
    }),

  unlockNote: (id: number) =>
    apiFetch<Note>(`/api/notes/${id}/unlock`, { method: "PATCH" }),

  getFolders: () => apiFetch<Folder[]>("/api/folders"),

  createFolder: (data: { name: string; parentId?: number | null }) =>
    apiFetch<Folder>("/api/folders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFolder: (id: number, data: { name?: string; parentId?: number | null }) =>
    apiFetch<Folder>(`/api/folders/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteFolder: (id: number) =>
    apiFetch<void>(`/api/folders/${id}`, { method: "DELETE" }),

  getSmartFolders: () => apiFetch<SmartFolder[]>("/api/smart-folders"),

  getTags: () => apiFetch<string[]>("/api/tags"),

  getVersions: (noteId: number) =>
    apiFetch<{ versions: NoteVersion[] }>(`/api/notes/${noteId}/versions`),

  getVersion: (noteId: number, versionId: number) =>
    apiFetch<{ version: NoteVersion }>(
      `/api/notes/${noteId}/versions/${versionId}`
    ),

  createVersion: (noteId: number) =>
    apiFetch<{ created: boolean }>(`/api/notes/${noteId}/versions`, {
      method: "POST",
    }),

  deleteVersion: (noteId: number, versionId: number) =>
    apiFetch<{ deleted: boolean }>(
      `/api/notes/${noteId}/versions/${versionId}`,
      { method: "DELETE" }
    ),

  aiComplete: (data: {
    provider: string;
    apiKey: string;
    model: string;
    prompt: string;
    systemPrompt?: string;
    noteContext?: string;
  }) =>
    apiFetch<{ result: string; tokensUsed: number | null }>("/api/ai/complete", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getModels: (provider: string, apiKey: string) =>
    apiFetch<{ models: { id: string; name: string }[]; source: string }>(
      "/api/models",
      {
        method: "POST",
        body: JSON.stringify({ provider, apiKey }),
      }
    ),
};
