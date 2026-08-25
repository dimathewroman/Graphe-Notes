"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import type * as Y from "yjs";
import {
  createNoteCollaborationIdentity,
  createNoteCollaborationLifecycleCoordinator,
  type NoteCollaborationIdentityInput,
  type NoteCollaborationSession as CoordinatedSession,
} from "@/lib/collaboration/note-collaboration-lifecycle";
import {
  createNoteCollaborationSession,
  type NoteCollaborationSession,
  type RevisionedCollaborationPersistence,
} from "@/lib/collaboration/note-collaboration-session";

type PersistenceFactory = () => RevisionedCollaborationPersistence;

export interface UseNoteCollaborationOptions {
  identity: NoteCollaborationIdentityInput | null;
  serverRevision: string | null;
  onPersistenceFailure?: () => void;
}

export interface UseNoteCollaborationResult {
  status: "loading" | "ready" | "unavailable";
  bootstrapSource: "local" | "server" | null;
  yDocument: Y.Doc | null;
  recordAuthoritativeServerRevision(revision: string): Promise<boolean>;
}

function identityKey(
  identity: NoteCollaborationIdentityInput | null,
): string | null {
  if (!identity) return null;
  return identity.mode === "demo"
    ? `demo:${identity.noteId}`
    : `authenticated:${identity.userId}:${identity.noteId}`;
}

function safeCapturePersistenceFailure(
  stage: "initialize" | "write" | "destroy",
) {
  Sentry.captureException(
    new Error(`Collaboration persistence ${stage} failed.`),
  );
}

export function useNoteCollaboration({
  identity,
  serverRevision,
  onPersistenceFailure,
}: UseNoteCollaborationOptions): UseNoteCollaborationResult {
  const key = identityKey(identity);
  const [status, setStatus] =
    useState<UseNoteCollaborationResult["status"]>("loading");
  const [bootstrapSource, setBootstrapSource] =
    useState<UseNoteCollaborationResult["bootstrapSource"]>(null);
  const [yDocument, setYDocument] = useState<Y.Doc | null>(null);
  const persistenceFactoryRef = useRef<PersistenceFactory | null>(null);
  const serverRevisionRef = useRef<string | null>(serverRevision);
  const sessionsRef = useRef(new Map<string, NoteCollaborationSession>());
  const failureRef = useRef(onPersistenceFailure);
  const activeSessionRef = useRef<NoteCollaborationSession | null>(null);
  const coordinatorRef = useRef<ReturnType<
    typeof createNoteCollaborationLifecycleCoordinator
  > | null>(null);
  failureRef.current = onPersistenceFailure;
  serverRevisionRef.current = serverRevision;

  if (!coordinatorRef.current) {
    coordinatorRef.current = createNoteCollaborationLifecycleCoordinator(
      (sessionIdentity) => {
        const factory = persistenceFactoryRef.current;
        if (!factory)
          throw new Error("Collaboration persistence is not available.");
        const session = createNoteCollaborationSession({
          identity: sessionIdentity,
          serverRevision: serverRevisionRef.current,
          persistence: factory(),
        });
        sessionsRef.current.set(sessionIdentity.documentId, session);
        const coordinated: CoordinatedSession = {
          identity: sessionIdentity,
          destroy: async () => {
            sessionsRef.current.delete(sessionIdentity.documentId);
            if (activeSessionRef.current === session)
              activeSessionRef.current = null;
            await session.destroy();
          },
        };
        return coordinated;
      },
    );
  }

  useEffect(() => {
    let cancelled = false;
    const coordinator = coordinatorRef.current!;
    setStatus("loading");
    setBootstrapSource(null);
    setYDocument(null);

    if (!identity || !key) {
      setStatus("unavailable");
      return () => undefined;
    }

    void (async () => {
      try {
        const { createIndexeddbCollaborationPersistence } =
          await import("@/lib/collaboration/indexeddb-persistence");
        if (cancelled) return;
        persistenceFactoryRef.current = createIndexeddbCollaborationPersistence;

        const coordinated = await coordinator.activate(identity);
        if (!coordinated || cancelled) return;
        const session = sessionsRef.current.get(
          coordinated.identity.documentId,
        );
        if (!session || !coordinator.isCurrent(coordinated)) return;

        const source = await session.ready;
        if (cancelled || !coordinator.isCurrent(coordinated)) return;

        activeSessionRef.current = session;
        setBootstrapSource(source);
        setYDocument(session.yDocument);
        setStatus("ready");
      } catch {
        if (cancelled) return;
        await coordinator.destroy().catch(() => undefined);
        safeCapturePersistenceFailure("initialize");
        failureRef.current?.();
        setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      void coordinator.destroy().catch(() => {
        safeCapturePersistenceFailure("destroy");
        failureRef.current?.();
      });
    };
    // The lifecycle is deliberately keyed only by ownership + note identity. A
    // newer server revision becomes the base for the active document, not a new
    // editor/document lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const recordAuthoritativeServerRevision = useCallback(
    async (revision: string) => {
      const session = activeSessionRef.current;
      if (!session) return false;
      try {
        await session.recordAuthoritativeServerRevision(revision);
        return true;
      } catch {
        safeCapturePersistenceFailure("write");
        failureRef.current?.();
        return false;
      }
    },
    [],
  );

  return {
    status,
    bootstrapSource,
    yDocument,
    recordAuthoritativeServerRevision,
  };
}
