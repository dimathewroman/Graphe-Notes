// useNoteVersions — single source of truth for the version history feature.
//
// Shape goals:
//   • Real mode goes through /api/notes/:id/versions (no Orval hooks — version
//     endpoints aren't in openapi.yaml).
//   • Demo mode keeps the same hook surface but stores everything in the React
//     Query cache under ["noteVersions", noteId]. Versions can be created,
//     labelled, restored and deleted with no backend.
//
// All hooks honour useDemoMode() so call sites don't need to branch.

import { useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useDemoMode } from "@/lib/demo-context";

export type VersionSource =
  | "manual_save"
  | "auto_save"
  | "pre_ai_rewrite"
  | "restore"
  | "auto_close";

export interface NoteVersionMeta {
  id: number;
  noteId: number;
  title: string;
  contentText: string | null;
  label: string | null;
  source: VersionSource | null;
  createdAt: string;
}

export interface NoteVersionFull extends NoteVersionMeta {
  content: string;
}

const noteVersionsKey = (noteId: number) => ["noteVersions", noteId] as const;
const noteVersionDetailKey = (noteId: number, versionId: number) =>
  ["noteVersions", noteId, versionId] as const;

// Auto-save threshold (mirrored on the server). Used by the client only as a
// short-circuit so we don't waste a network request when nothing has changed.
const AUTO_SAVE_MIN_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_SAVE_CHAR_DELTA_THRESHOLD = 100;
const MAX_VERSIONS = 50;

// Demo: monotonic ID generator. Real mode uses serial IDs from Postgres.
let demoVersionIdCounter = 100_000;
function nextDemoVersionId(): number {
  demoVersionIdCounter += 1;
  return demoVersionIdCounter;
}

// Bump this once at module load so seeded demo versions don't collide with
// IDs created during the session.
export function seedDemoVersionIdCounter(maxSeenId: number) {
  if (maxSeenId >= demoVersionIdCounter) {
    demoVersionIdCounter = maxSeenId + 1;
  }
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export function useNoteVersionsList(noteId: number | null) {
  const isDemo = useDemoMode();
  return useQuery<NoteVersionMeta[]>({
    queryKey: noteId != null ? noteVersionsKey(noteId) : ["noteVersions", "none"],
    queryFn: async () => {
      if (noteId == null) return [];
      if (isDemo) {
        // Demo data is pre-populated by enterDemoMode(). Return whatever is
        // already in the cache (or empty if the user hasn't touched the note).
        return [];
      }
      const r = await authenticatedFetch(`/api/notes/${noteId}/versions`);
      if (!r.ok) throw new Error("Failed to load versions");
      const data = (await r.json()) as { versions: NoteVersionMeta[] };
      return data.versions ?? [];
    },
    enabled: noteId != null,
    staleTime: isDemo ? Infinity : 30_000,
  });
}

export function useNoteVersionDetail(
  noteId: number | null,
  versionId: number | null,
) {
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  return useQuery<NoteVersionFull | null>({
    queryKey:
      noteId != null && versionId != null
        ? noteVersionDetailKey(noteId, versionId)
        : ["noteVersions", "detail", "none"],
    queryFn: async () => {
      if (noteId == null || versionId == null) return null;
      if (isDemo) {
        const list =
          (queryClient.getQueryData<NoteVersionFull[]>(
            noteVersionsKey(noteId),
          ) as NoteVersionFull[] | undefined) ?? [];
        const match = list.find((v) => v.id === versionId);
        return match ?? null;
      }
      const r = await authenticatedFetch(
        `/api/notes/${noteId}/versions/${versionId}`,
      );
      if (!r.ok) throw new Error("Failed to load version");
      const data = (await r.json()) as { version: NoteVersionFull };
      return data.version ?? null;
    },
    enabled: noteId != null && versionId != null,
    staleTime: isDemo ? Infinity : 60_000,
  });
}

// ─── Writes ────────────────────────────────────────────────────────────────

interface CreateVersionInput {
  noteId: number;
  source: VersionSource;
  label?: string | null;
  // Snapshot data — used for demo mode and for client-side threshold checks.
  // The server reads from the DB, so these aren't sent to it.
  title: string;
  content: string;
  contentText: string | null;
}

export function useCreateNoteVersion() {
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  return useCallback(
    async (input: CreateVersionInput): Promise<NoteVersionFull | null> => {
      const { noteId, source, label, title, content, contentText } = input;

      // Client-side short-circuit for auto-save: if neither the time nor the
      // character delta threshold is met, skip the network request entirely.
      if (source === "auto_save") {
        const cached =
          queryClient.getQueryData<NoteVersionMeta[]>(noteVersionsKey(noteId)) ??
          [];
        const latest = cached[0];
        if (latest) {
          const age = Date.now() - new Date(latest.createdAt).getTime();
          const prevLen = latest.contentText?.length ?? 0;
          const currLen = contentText?.length ?? 0;
          const delta = Math.abs(currLen - prevLen);
          const meetsThreshold =
            age >= AUTO_SAVE_MIN_INTERVAL_MS ||
            delta > AUTO_SAVE_CHAR_DELTA_THRESHOLD;
          if (!meetsThreshold) return null;
        }
      }

      if (isDemo) {
        const created: NoteVersionFull = {
          id: nextDemoVersionId(),
          noteId,
          title,
          content,
          contentText,
          label: label ?? null,
          source,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<NoteVersionFull[]>(
          noteVersionsKey(noteId),
          (old) => {
            const next = [created, ...((old ?? []) as NoteVersionFull[])];
            // Enforce 50-cap in demo too.
            return next.slice(0, MAX_VERSIONS);
          },
        );
        return created;
      }

      try {
        const r = await authenticatedFetch(`/api/notes/${noteId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, label: label ?? null }),
        });
        if (!r.ok) return null;
        const data = (await r.json()) as {
          created: boolean;
          version?: NoteVersionFull;
        };
        if (!data.created || !data.version) return null;
        // Optimistic insert into the list cache so the panel updates without a
        // refetch round-trip.
        queryClient.setQueryData<NoteVersionMeta[]>(
          noteVersionsKey(noteId),
          (old) => {
            const next = [
              data.version as NoteVersionMeta,
              ...((old ?? []) as NoteVersionMeta[]),
            ];
            return next.slice(0, MAX_VERSIONS);
          },
        );
        return data.version ?? null;
      } catch {
        return null;
      }
    },
    [isDemo, queryClient],
  );
}

export function useUpdateNoteVersionLabel() {
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      versionId,
      label,
    }: {
      noteId: number;
      versionId: number;
      label: string | null;
    }) => {
      const trimmed =
        label && label.trim().length > 0 ? label.trim().slice(0, 200) : null;
      if (isDemo) {
        return { noteId, versionId, label: trimmed };
      }
      const r = await authenticatedFetch(
        `/api/notes/${noteId}/versions/${versionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: trimmed }),
        },
      );
      if (!r.ok) throw new Error("Failed to update label");
      return { noteId, versionId, label: trimmed };
    },
    onSuccess: ({ noteId, versionId, label }) => {
      queryClient.setQueryData<NoteVersionMeta[]>(
        noteVersionsKey(noteId),
        (old) =>
          (old ?? []).map((v) => (v.id === versionId ? { ...v, label } : v)),
      );
      queryClient.setQueryData<NoteVersionFull | null>(
        noteVersionDetailKey(noteId, versionId),
        (old) => (old ? { ...old, label } : old),
      );
    },
  });
}

export function useDeleteNoteVersion() {
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      versionId,
    }: {
      noteId: number;
      versionId: number;
    }) => {
      if (isDemo) return { noteId, versionId };
      const r = await authenticatedFetch(
        `/api/notes/${noteId}/versions/${versionId}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error("Failed to delete version");
      return { noteId, versionId };
    },
    onSuccess: ({ noteId, versionId }) => {
      queryClient.setQueryData<NoteVersionMeta[]>(
        noteVersionsKey(noteId),
        (old) => (old ?? []).filter((v) => v.id !== versionId),
      );
      queryClient.removeQueries({
        queryKey: noteVersionDetailKey(noteId, versionId),
      });
    },
  });
}

// Convenience helper used by NoteShell on note close to flush a final version
// when there are unsaved changes.
export { noteVersionsKey, noteVersionDetailKey };
