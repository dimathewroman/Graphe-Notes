import type { NoteCollaborationIdentity } from "./note-collaboration-lifecycle";

export interface CollaborationReplicaPersistence {
  eraseDocument(documentId: string): Promise<void>;
  eraseAuthenticatedOwner(userId: string): Promise<void>;
  eraseStaleAuthenticatedOwners(currentUserId: string): Promise<void>;
  eraseDemo(): Promise<void>;
  eraseAll(): Promise<void>;
}

export interface CollaborationReplicaDispositionOptions {
  persistence: CollaborationReplicaPersistence;
  disposeActive(scope: string): Promise<void>;
}

export interface CollaborationReplicaDisposition {
  eraseNote(identity: NoteCollaborationIdentity): Promise<void>;
  eraseAuthenticatedOwner(userId: string): Promise<void>;
  eraseStaleAuthenticatedOwners(currentUserId: string): Promise<void>;
  eraseDemo(): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * Teardown always precedes deletion so an open Yjs provider cannot rewrite a
 * cleared replica. Scope strings stay private to the browser adapter and are
 * never sent to telemetry.
 */
export function createCollaborationReplicaDisposition({
  persistence,
  disposeActive,
}: CollaborationReplicaDispositionOptions): CollaborationReplicaDisposition {
  return {
    async eraseNote(identity) {
      await disposeActive(identity.documentId);
      await persistence.eraseDocument(identity.documentId);
    },
    async eraseAuthenticatedOwner(userId) {
      await disposeActive(`authenticated:${userId}`);
      await persistence.eraseAuthenticatedOwner(userId);
    },
    async eraseStaleAuthenticatedOwners(currentUserId) {
      await disposeActive(`authenticated-except:${currentUserId}`);
      await persistence.eraseStaleAuthenticatedOwners(currentUserId);
    },
    async eraseDemo() {
      await disposeActive("demo");
      await persistence.eraseDemo();
    },
    async clearAll() {
      await disposeActive("all");
      await persistence.eraseAll();
    },
  };
}

type ActiveReplica = {
  documentId: string;
  scope: string;
  dispose(): Promise<void>;
};

const activeReplicas = new Map<string, ActiveReplica>();

function matchesScope(replica: ActiveReplica, scope: string): boolean {
  if (scope.startsWith("authenticated-except:")) {
    const currentScope = `authenticated:${scope.slice("authenticated-except:".length)}`;
    return (
      replica.scope.startsWith("authenticated:") &&
      replica.scope !== currentScope
    );
  }
  return (
    scope === "all" || replica.documentId === scope || replica.scope === scope
  );
}

export async function runReplicaProtectedBoundary(
  cleanup: () => Promise<void>,
  continueBoundary: () => Promise<void>,
): Promise<void> {
  await cleanup();
  await continueBoundary();
}

async function disposeActiveReplicas(scope: string): Promise<void> {
  const replicas = [...activeReplicas.values()].filter((replica) =>
    matchesScope(replica, scope),
  );
  await Promise.all(
    replicas.map(async (replica) => {
      await replica.dispose();
      if (activeReplicas.get(replica.documentId) === replica) {
        activeReplicas.delete(replica.documentId);
      }
    }),
  );
}

function identityScope(identity: NoteCollaborationIdentity): string {
  return identity.mode === "demo"
    ? "demo"
    : `authenticated:${identity.documentId.split(":note:", 1)[0]?.slice("graphe-yjs:v1:user:".length) ?? ""}`;
}

/** Register the active browser session so explicit erasure fences writers. */
export function registerActiveCollaborationReplica(
  identity: NoteCollaborationIdentity,
  dispose: () => Promise<void>,
): () => void {
  const replica: ActiveReplica = {
    documentId: identity.documentId,
    scope: identityScope(identity),
    dispose,
  };
  activeReplicas.set(identity.documentId, replica);
  return () => {
    if (activeReplicas.get(identity.documentId) === replica) {
      activeReplicas.delete(identity.documentId);
    }
  };
}

async function browserDisposition(): Promise<CollaborationReplicaDisposition> {
  const persistence = await import("./indexeddb-persistence");
  return createCollaborationReplicaDisposition({
    persistence,
    disposeActive: disposeActiveReplicas,
  });
}

const cleanupTasks = new Map<string, Promise<void>>();

function shareCleanup(
  key: string,
  cleanup: () => Promise<void>,
): Promise<void> {
  const active = cleanupTasks.get(key);
  if (active) return active;
  const task = cleanup().finally(() => {
    if (cleanupTasks.get(key) === task) cleanupTasks.delete(key);
  });
  cleanupTasks.set(key, task);
  return task;
}

export async function eraseNoteCollaborationReplica(
  identity: NoteCollaborationIdentity,
): Promise<void> {
  return shareCleanup(`note:${identity.documentId}`, async () =>
    (await browserDisposition()).eraseNote(identity),
  );
}

export async function eraseAuthenticatedCollaborationReplicas(
  userId: string,
): Promise<void> {
  return shareCleanup(`owner:${userId}`, async () =>
    (await browserDisposition()).eraseAuthenticatedOwner(userId),
  );
}

export async function eraseStaleAuthenticatedCollaborationReplicas(
  currentUserId: string,
): Promise<void> {
  return shareCleanup(`stale-owners:${currentUserId}`, async () =>
    (await browserDisposition()).eraseStaleAuthenticatedOwners(currentUserId),
  );
}

export async function eraseDemoCollaborationReplicas(): Promise<void> {
  return shareCleanup("demo", async () =>
    (await browserDisposition()).eraseDemo(),
  );
}

export async function clearAllCollaborationReplicas(): Promise<void> {
  return shareCleanup("all", async () =>
    (await browserDisposition()).clearAll(),
  );
}
