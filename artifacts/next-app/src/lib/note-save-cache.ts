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

export interface IssuedNoteSaveOrdering {
  saveSessionId: string;
  saveSequence: number;
}

/**
 * Rejects a late successful response before it can replace newer server state
 * in the client. A mounted note shell owns one browser save session, so a
 * different session is unexpected and deliberately cannot supersede it.
 */
export class NoteSaveResponseFence {
  private readonly latestApplied = new Map<number, IssuedNoteSaveOrdering>();

  accepts(noteId: number, incoming: IssuedNoteSaveOrdering): boolean {
    const previous = this.latestApplied.get(noteId);
    if (
      previous &&
      (previous.saveSessionId !== incoming.saveSessionId ||
        previous.saveSequence >= incoming.saveSequence)
    ) {
      return false;
    }

    this.latestApplied.set(noteId, incoming);
    return true;
  }
}

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
