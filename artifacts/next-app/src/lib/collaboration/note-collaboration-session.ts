import * as Y from "yjs";
import {
  createCollaborationDocument,
  type CollaborationDocument,
  type RevisionedCollaborationPersistenceAdapter,
} from "./collaboration-document";
import {
  createNoteCollaborationIdentity,
  shouldRestoreLocalDraft,
  type NoteCollaborationIdentity,
} from "./note-collaboration-lifecycle";

export { createNoteCollaborationIdentity } from "./note-collaboration-lifecycle";

export type RevisionedCollaborationPersistence =
  RevisionedCollaborationPersistenceAdapter;

type ErasableRevisionedCollaborationPersistence =
  RevisionedCollaborationPersistence & {
    disableAndErase(): Promise<void>;
  };

function isErasablePersistence(
  persistence: RevisionedCollaborationPersistence,
): persistence is ErasableRevisionedCollaborationPersistence {
  return typeof (persistence as { disableAndErase?: unknown }).disableAndErase === "function";
}

export type CollaborationBootstrapSource = "local" | "server";

export interface NoteCollaborationSession {
  readonly collaboration: CollaborationDocument;
  readonly yDocument: Y.Doc;
  readonly ready: Promise<CollaborationBootstrapSource>;
  recordAuthoritativeServerRevision(revision: string): Promise<void>;
  disableLocalPersistence(): Promise<void>;
  destroy(): Promise<void>;
}

export interface CreateNoteCollaborationSessionOptions {
  identity: NoteCollaborationIdentity;
  serverRevision: string | null;
  persistence: RevisionedCollaborationPersistence;
}

function containsTiptapContent(document: Y.Doc): boolean {
  return document.getXmlFragment("default").length > 0;
}

function clearTiptapContent(document: Y.Doc): void {
  const fragment = document.getXmlFragment("default");
  if (fragment.length === 0) return;
  document.transact(() => fragment.delete(0, fragment.length));
}

function containsUnsafeAttachmentContent(document: Y.Doc): boolean {
  const serialized = document.getXmlFragment("default").toString();
  return /<(?:image|imageUpload)\b/i.test(serialized);
}

export function createNoteCollaborationSession({
  identity,
  serverRevision,
  persistence,
}: CreateNoteCollaborationSessionOptions): NoteCollaborationSession {
  const collaboration = createCollaborationDocument({
    documentId: identity.documentId,
    persistence,
  });
  const yDocument = collaboration.getYDocument();
  const ready = collaboration.ready.then(async () => {
    if (containsUnsafeAttachmentContent(yDocument)) {
      if (!isErasablePersistence(persistence)) {
        throw new Error("Attachment-bearing collaboration state cannot be erased.");
      }
      await persistence.disableAndErase();
      clearTiptapContent(yDocument);
      return "server" as const;
    }
    const persistedBaseRevision = await persistence.restoreBaseRevision(
      identity.documentId,
    );
    if (
      shouldRestoreLocalDraft({
        hasLocalDraft: containsTiptapContent(yDocument),
        persistedBaseRevision,
        serverRevision,
      })
    ) {
      return "local" as const;
    }

    clearTiptapContent(yDocument);
    return "server" as const;
  });

  return {
    collaboration,
    yDocument,
    ready,
    async recordAuthoritativeServerRevision(revision) {
      if (
        !shouldRestoreLocalDraft({
          hasLocalDraft: true,
          persistedBaseRevision: revision,
          serverRevision: revision,
        })
      ) {
        throw new Error("The server did not return a valid note revision.");
      }
      await collaboration.flush();
      await persistence.persistBaseRevision(identity.documentId, revision);
    },
    async disableLocalPersistence() {
      if (!isErasablePersistence(persistence)) {
        throw new Error("Local collaboration persistence cannot be erased.");
      }
      await persistence.disableAndErase();
    },
    destroy() {
      return collaboration.destroy();
    },
  };
}
