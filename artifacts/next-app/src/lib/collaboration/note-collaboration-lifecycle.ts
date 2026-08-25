export type NoteCollaborationIdentityInput =
  | { mode: "demo"; noteId: string | number }
  | { mode: "authenticated"; userId: string; noteId: string | number };

export interface NoteCollaborationIdentity {
  readonly mode: "demo" | "authenticated";
  readonly noteId: string | number;
  readonly documentId: string;
}

export interface LocalDraftRecoveryInput {
  hasLocalDraft: boolean;
  persistedBaseRevision: string | null;
  serverRevision: string | null;
}

export interface NoteCollaborationSession {
  readonly identity: NoteCollaborationIdentity;
  destroy(): void | Promise<void>;
}

type NoteCollaborationSessionFactory = (
  identity: NoteCollaborationIdentity,
) => NoteCollaborationSession | Promise<NoteCollaborationSession>;

const SERVER_REVISION_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isAuthoritativeServerRevision(value: string | null): value is string {
  return (
    value !== null &&
    SERVER_REVISION_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/**
 * Lifecycle callbacks carry the note id captured when their work began. An
 * absent id preserves existing call sites; a mismatched id is always fenced.
 */
export function isCurrentNoteLifecycleSource(
  sourceContentKey: string | number | undefined,
  activeNoteId: number | null,
): boolean {
  return sourceContentKey === undefined || sourceContentKey === activeNoteId;
}

export function createNoteCollaborationIdentity(
  input: NoteCollaborationIdentityInput,
): NoteCollaborationIdentity {
  if (input.mode === "authenticated" && !input.userId.trim()) {
    throw new Error("A non-empty collaboration owner id is required.");
  }

  const namespace = input.mode === "demo" ? "demo" : `user:${input.userId}`;
  return {
    mode: input.mode,
    noteId: input.noteId,
    documentId: `graphe-yjs:v1:${namespace}:note:${input.noteId}`,
  };
}

/**
 * Local state is usable only when it was written against the exact server
 * revision returned by the note API. The values are opaque equality tokens;
 * their timestamps are never ordered against a client clock.
 */
export function shouldRestoreLocalDraft({
  hasLocalDraft,
  persistedBaseRevision,
  serverRevision,
}: LocalDraftRecoveryInput): boolean {
  return (
    hasLocalDraft &&
    isAuthoritativeServerRevision(persistedBaseRevision) &&
    isAuthoritativeServerRevision(serverRevision) &&
    persistedBaseRevision === serverRevision
  );
}

export interface NoteCollaborationLifecycleCoordinator {
  activate(
    input: NoteCollaborationIdentityInput,
  ): Promise<NoteCollaborationSession | null>;
  current(): NoteCollaborationSession | null;
  isCurrent(session: NoteCollaborationSession): boolean;
  destroy(): Promise<void>;
}

export function createNoteCollaborationLifecycleCoordinator(
  createSession: NoteCollaborationSessionFactory,
): NoteCollaborationLifecycleCoordinator {
  let active: NoteCollaborationSession | null = null;
  let teardown: Promise<void> | null = null;
  let generation = 0;

  const releaseActive = (): Promise<void> => {
    if (teardown) return teardown;

    const previous = active;
    active = null;
    teardown = previous
      ? Promise.resolve(previous.destroy()).then(() => undefined)
      : Promise.resolve();
    teardown = teardown.finally(() => {
      teardown = null;
    });
    return teardown;
  };

  return {
    async activate(input) {
      const activation = ++generation;
      await releaseActive();
      if (activation !== generation) return null;

      const session = await createSession(
        createNoteCollaborationIdentity(input),
      );
      if (activation !== generation) {
        await session.destroy();
        return null;
      }

      active = session;
      return session;
    },
    current() {
      return active;
    },
    isCurrent(session) {
      return active === session;
    },
    destroy() {
      generation += 1;
      return releaseActive();
    },
  };
}
