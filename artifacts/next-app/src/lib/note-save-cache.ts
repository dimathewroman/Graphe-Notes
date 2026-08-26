import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
} from "@workspace/api-client-react";

type SavedNote = {
  id: number;
  content: string;
};

type NoteSaveQueryClient = {
  setQueryData: (key: readonly unknown[], value: unknown) => void;
  setQueriesData: (
    filters: { queryKey: readonly unknown[] },
    updater: (old: unknown) => unknown,
  ) => void;
};

/** Keeps the editor and every note-list cache on the exact server response. */
export function applyAuthoritativeNoteSaveToCache<TSavedNote extends SavedNote>(
  queryClient: NoteSaveQueryClient,
  savedNote: TSavedNote,
): void {
  queryClient.setQueryData(getGetNoteQueryKey(savedNote.id), savedNote);
  const { content: _content, ...listFields } = savedNote;
  queryClient.setQueriesData(
    { queryKey: getGetNotesQueryKey() },
    (old) =>
      Array.isArray(old)
        ? old.map((note) =>
            note && typeof note === "object" && note.id === savedNote.id
              ? { ...note, ...listFields }
              : note,
          )
        : old,
  );
}
