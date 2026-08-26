export interface NoteSaveOrdering {
  baseRevision: string;
  saveSessionId: string;
  saveSequence: number;
}

export interface StoredNoteSaveOrdering {
  revision: string;
  saveSessionId: string | null;
  saveSequence: number | null;
}

/**
 * Models the server predicate for deterministic client/domain tests. The route
 * uses the equivalent SQL predicate in the same owner-scoped UPDATE statement.
 */
export function acceptsOrderedNoteSave(
  stored: StoredNoteSaveOrdering,
  incoming: NoteSaveOrdering,
): boolean {
  return (
    stored.revision === incoming.baseRevision ||
    (stored.saveSessionId === incoming.saveSessionId &&
      stored.saveSequence !== null &&
      incoming.saveSequence > stored.saveSequence)
  );
}

export function createBrowserSaveSessionId(): string {
  return crypto.randomUUID();
}
