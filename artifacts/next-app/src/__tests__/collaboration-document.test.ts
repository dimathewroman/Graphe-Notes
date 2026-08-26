import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
  createCollaborationDocument,
  type CollaborationProviderAdapter,
  type CollaborationPersistenceAdapter,
} from "@/lib/collaboration/collaboration-document";
import {
  createIndexeddbCollaborationPersistence,
  eraseAuthenticatedOwner,
  eraseDemo,
  eraseStaleAuthenticatedOwners,
} from "@/lib/collaboration/indexeddb-persistence";

function readBody(update: Uint8Array): string {
  const document = new Y.Doc();
  Y.applyUpdate(document, update);
  return document.getText("body").toString();
}

function seededUpdates() {
  const seedDocument = new Y.Doc();
  seedDocument.getText("body").insert(0, "core");
  const seed = Y.encodeStateAsUpdate(seedDocument);
  const seedStateVector = Y.encodeStateVector(seedDocument);

  const createUpdate = (change: (body: Y.Text) => void) => {
    const document = new Y.Doc();
    Y.applyUpdate(document, seed);
    change(document.getText("body"));
    return Y.encodeStateAsUpdate(document, seedStateVector);
  };

  return {
    seed,
    left: createUpdate((body) => body.insert(0, "left-")),
    right: createUpdate((body) => body.insert(body.length, "-right")),
  };
}

class MemoryPersistence implements CollaborationPersistenceAdapter {
  private readonly states = new Map<string, Uint8Array>();
  persistCalls = 0;
  destroyCalls = 0;

  async restore(documentId: string): Promise<Uint8Array | null> {
    return this.states.get(documentId) ?? null;
  }

  async persist(documentId: string, state: Uint8Array): Promise<void> {
    this.persistCalls += 1;
    this.states.set(documentId, state);
  }

  async destroy(): Promise<void> {
    this.destroyCalls += 1;
  }
}

function deferred<Value>() {
  let resolve: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {
    promise,
    resolve(value: Value) {
      resolve(value);
    },
  };
}

function createEmptyIndexeddbDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
}

class PendingRestorePersistence implements CollaborationPersistenceAdapter {
  private readonly pendingRestore = deferred<Uint8Array | null>();
  restoreSettled = false;
  destroyCalls = 0;
  destroyedBeforeRestoreSettled = false;

  restore(): Promise<Uint8Array | null> {
    return this.pendingRestore.promise;
  }

  async persist(): Promise<void> {}

  async destroy(): Promise<void> {
    this.destroyCalls += 1;
    this.destroyedBeforeRestoreSettled ||= !this.restoreSettled;
  }

  finishRestore(state: Uint8Array | null) {
    this.restoreSettled = true;
    this.pendingRestore.resolve(state);
  }
}

describe("collaboration document", () => {
  it("restores isolated documents after browser persistence is reopened", async () => {
    const updates = seededUpdates();
    const first = createCollaborationDocument({
      documentId: "note-1",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    const second = createCollaborationDocument({
      documentId: "note-2",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    await Promise.all([first.ready, second.ready]);

    first.applyLocalUpdate(updates.seed);
    first.applyLocalUpdate(updates.left);
    second.applyLocalUpdate(updates.seed);
    second.applyLocalUpdate(updates.right);
    await Promise.all([first.flush(), second.flush()]);
    await Promise.all([first.destroy(), second.destroy()]);

    const reopenedFirst = createCollaborationDocument({
      documentId: "note-1",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    const reopenedSecond = createCollaborationDocument({
      documentId: "note-2",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    await Promise.all([reopenedFirst.ready, reopenedSecond.ready]);

    expect(readBody(reopenedFirst.exportState())).toBe("left-core");
    expect(readBody(reopenedSecond.exportState())).toBe("core-right");

    await Promise.all([reopenedFirst.destroy(), reopenedSecond.destroy()]);
  });

  it("persists the exact server base revision separately from Yjs document updates", async () => {
    const documentId = "revision-note";
    const revision = "2026-08-25T12:34:56.789Z";
    const first = createIndexeddbCollaborationPersistence();

    await expect(first.restoreBaseRevision(documentId)).resolves.toBeNull();
    await first.persistBaseRevision(documentId, revision);
    await first.destroy();

    const reopened = createIndexeddbCollaborationPersistence();
    await expect(reopened.restoreBaseRevision(documentId)).resolves.toBe(
      revision,
    );
    await reopened.destroy();
  });

  it("erases only the registered local replicas for a leaving owner or demo exit", async () => {
    const updates = seededUpdates();
    const ownerADocumentId = "graphe-yjs:v1:user:owner-a:note:77";
    const ownerBDocumentId = "graphe-yjs:v1:user:owner-b:note:77";
    const demoDocumentId = "graphe-yjs:v1:demo:note:77";
    const documents = [ownerADocumentId, ownerBDocumentId, demoDocumentId].map(
      (documentId) =>
        createCollaborationDocument({
          documentId,
          persistence: createIndexeddbCollaborationPersistence(),
        }),
    );
    await Promise.all(documents.map((document) => document.ready));
    documents.forEach((document) => document.applyLocalUpdate(updates.seed));
    await Promise.all(documents.map((document) => document.flush()));
    await Promise.all(documents.map((document) => document.destroy()));

    await eraseAuthenticatedOwner("owner-a");
    const reopenedOwnerA = createCollaborationDocument({
      documentId: ownerADocumentId,
      persistence: createIndexeddbCollaborationPersistence(),
    });
    const reopenedOwnerB = createCollaborationDocument({
      documentId: ownerBDocumentId,
      persistence: createIndexeddbCollaborationPersistence(),
    });
    const reopenedDemo = createCollaborationDocument({
      documentId: demoDocumentId,
      persistence: createIndexeddbCollaborationPersistence(),
    });
    await Promise.all([
      reopenedOwnerA.ready,
      reopenedOwnerB.ready,
      reopenedDemo.ready,
    ]);
    expect(readBody(reopenedOwnerA.exportState())).toBe("");
    expect(readBody(reopenedOwnerB.exportState())).toBe("core");
    expect(readBody(reopenedDemo.exportState())).toBe("core");
    await Promise.all([
      reopenedOwnerA.destroy(),
      reopenedOwnerB.destroy(),
      reopenedDemo.destroy(),
    ]);

    await eraseDemo();
    const reopenedAfterDemoExit = createCollaborationDocument({
      documentId: demoDocumentId,
      persistence: createIndexeddbCollaborationPersistence(),
    });
    await reopenedAfterDemoExit.ready;
    expect(readBody(reopenedAfterDemoExit.exportState())).toBe("");
    await reopenedAfterDemoExit.destroy();
    await eraseAuthenticatedOwner("owner-b");
  });

  it("erases a strict pre-registry owner replica without deleting unrelated databases", async () => {
    const legacyName =
      "graphe-collaboration:graphe-yjs:v1:user:legacy-owner:note:91";
    const unrelatedName = "unrelated-application-database";
    const lookalikeName = "graphe-collaboration:not-a-graphe-document";
    await Promise.all([
      createEmptyIndexeddbDatabase(legacyName),
      createEmptyIndexeddbDatabase(unrelatedName),
      createEmptyIndexeddbDatabase(lookalikeName),
    ]);

    await eraseAuthenticatedOwner("legacy-owner");

    const databases = await globalThis.indexedDB.databases();
    const names = databases.map((database) => database.name);
    expect(names).not.toContain(legacyName);
    expect(names).toContain(unrelatedName);
    expect(names).toContain(lookalikeName);
  });

  it("erases stale authenticated owners before activating the current owner", async () => {
    const staleName =
      "graphe-collaboration:graphe-yjs:v1:user:stale-owner:note:12";
    const currentName =
      "graphe-collaboration:graphe-yjs:v1:user:current-owner:note:12";
    await Promise.all([
      createEmptyIndexeddbDatabase(staleName),
      createEmptyIndexeddbDatabase(currentName),
    ]);

    await eraseStaleAuthenticatedOwners("current-owner");

    const names = (await globalThis.indexedDB.databases()).map(
      (database) => database.name,
    );
    expect(names).not.toContain(staleName);
    expect(names).toContain(currentName);
  });

  it("merges ordered writes from separate adapters for the same document", async () => {
    const updates = seededUpdates();
    const first = createCollaborationDocument({
      documentId: "shared-note",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    const second = createCollaborationDocument({
      documentId: "shared-note",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    await Promise.all([first.ready, second.ready]);

    first.applyLocalUpdate(updates.seed);
    await first.flush();
    second.applyLocalUpdate(updates.seed);
    await second.flush();
    first.applyLocalUpdate(updates.left);
    await first.flush();
    second.applyLocalUpdate(updates.right);
    await second.flush();
    await Promise.all([first.destroy(), second.destroy()]);

    const reopened = createCollaborationDocument({
      documentId: "shared-note",
      persistence: createIndexeddbCollaborationPersistence(),
    });
    await reopened.ready;

    expect(readBody(reopened.exportState())).toBe("left-core-right");
    await reopened.destroy();
  });

  it("fails closed and releases the document when IndexedDB cannot open", async () => {
    const open = vi
      .spyOn(globalThis.indexedDB, "open")
      .mockImplementation(() => {
        throw new Error("IndexedDB is unavailable");
      });
    let providerConnections = 0;
    const document = createCollaborationDocument({
      documentId: "note-1",
      persistence: createIndexeddbCollaborationPersistence(),
      provider: {
        connect() {
          providerConnections += 1;
          return { send() {}, destroy() {} };
        },
      },
    });

    await expect(document.ready).rejects.toThrow("IndexedDB is unavailable");
    await expect(document.destroy()).rejects.toThrow(
      "IndexedDB is unavailable",
    );

    document.applyLocalUpdate(seededUpdates().seed);
    expect(providerConnections).toBe(0);
    expect(readBody(document.exportState())).toBe("");
    open.mockRestore();
  });

  it("rejects a malformed document database and releases the document", async () => {
    const documentId = "malformed-note";
    await createEmptyIndexeddbDatabase(`graphe-collaboration:${documentId}`);

    let providerConnections = 0;
    const document = createCollaborationDocument({
      documentId,
      persistence: createIndexeddbCollaborationPersistence(),
      provider: {
        connect() {
          providerConnections += 1;
          return { send() {}, destroy() {} };
        },
      },
    });

    await expect(document.ready).rejects.toThrow("required object stores");

    const firstDestroy = document.destroy();
    const repeatedDestroy = document.destroy();
    expect(repeatedDestroy).toBe(firstDestroy);
    await expect(firstDestroy).rejects.toThrow("required object stores");

    document.applyLocalUpdate(seededUpdates().seed);
    expect(providerConnections).toBe(0);
    expect(readBody(document.exportState())).toBe("");
  }, 250);

  it("fails closed when the third target IndexedDB open fails", async () => {
    const nativeOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    let opens = 0;
    const open = vi
      .spyOn(globalThis.indexedDB, "open")
      .mockImplementation((name, version) => {
        opens += 1;
        if (opens === 3) throw new Error("Provider database is unavailable");
        return version === undefined
          ? nativeOpen(name)
          : nativeOpen(name, version);
      });
    let providerConnections = 0;
    const document = createCollaborationDocument({
      documentId: "provider-open-failure",
      persistence: createIndexeddbCollaborationPersistence(),
      provider: {
        connect() {
          providerConnections += 1;
          return { send() {}, destroy() {} };
        },
      },
    });

    try {
      await expect(document.ready).rejects.toThrow(
        "Provider database is unavailable",
      );

      const firstDestroy = document.destroy();
      const repeatedDestroy = document.destroy();
      expect(repeatedDestroy).toBe(firstDestroy);
      await expect(firstDestroy).rejects.toThrow(
        "Provider database is unavailable",
      );

      document.applyLocalUpdate(seededUpdates().seed);
      document.applyRemoteUpdate(seededUpdates().seed);
      expect(opens).toBe(3);
      expect(providerConnections).toBe(0);
      expect(readBody(document.exportState())).toBe("");
    } finally {
      open.mockRestore();
    }
  }, 250);

  it("converges two documents after differently ordered local and remote updates", async () => {
    const left = createCollaborationDocument({ documentId: "note-1" });
    const right = createCollaborationDocument({ documentId: "note-1" });
    await Promise.all([left.ready, right.ready]);

    const updates = seededUpdates();
    left.applyRemoteUpdate(updates.seed);
    right.applyRemoteUpdate(updates.seed);
    left.applyLocalUpdate(updates.left);
    right.applyLocalUpdate(updates.right);

    left.applyRemoteUpdate(updates.right);
    right.applyRemoteUpdate(updates.left);

    expect(readBody(left.exportState())).toBe("left-core-right");
    expect(readBody(right.exportState())).toBe("left-core-right");
  });

  it("restores the same logical document after restart through a persistence adapter", async () => {
    const persistence = new MemoryPersistence();
    const beforeRestart = createCollaborationDocument({
      documentId: "note-1",
      persistence,
    });
    await beforeRestart.ready;

    const updates = seededUpdates();
    beforeRestart.applyLocalUpdate(updates.seed);
    beforeRestart.applyLocalUpdate(updates.left);
    await beforeRestart.flush();

    const afterRestart = createCollaborationDocument({
      documentId: "note-1",
      persistence,
    });
    await afterRestart.ready;

    expect(readBody(afterRestart.exportState())).toBe("left-core");
  });

  it("uses a replaceable provider adapter for connection state and update delivery", async () => {
    const sentUpdates: Uint8Array[] = [];
    let deliverRemoteUpdate: ((update: Uint8Array) => void) | undefined;
    const provider: CollaborationProviderAdapter = {
      connect({ applyRemoteUpdate, setConnectionState }) {
        deliverRemoteUpdate = applyRemoteUpdate;
        setConnectionState("connecting");
        setConnectionState("connected");
        return {
          send(update) {
            sentUpdates.push(update);
          },
          destroy() {},
        };
      },
    };
    const document = createCollaborationDocument({
      documentId: "note-1",
      provider,
    });
    await document.ready;

    const updates = seededUpdates();
    deliverRemoteUpdate?.(updates.seed);
    document.applyLocalUpdate(updates.left);

    expect(document.connectionState()).toBe("connected");
    expect(readBody(document.exportState())).toBe("left-core");
    expect(sentUpdates).toHaveLength(1);
  });

  it("releases adapters once and ignores updates after destruction", async () => {
    const persistence = new MemoryPersistence();
    const sentUpdates: Uint8Array[] = [];
    const connection = {
      destroyCalls: 0,
      send(update: Uint8Array) {
        sentUpdates.push(update);
      },
      destroy() {
        connection.destroyCalls += 1;
      },
    };
    let deliverRemoteUpdate: ((update: Uint8Array) => void) | undefined;
    const provider: CollaborationProviderAdapter = {
      connect({ applyRemoteUpdate, setConnectionState }) {
        deliverRemoteUpdate = applyRemoteUpdate;
        setConnectionState("connected");
        return connection;
      },
    };
    const document = createCollaborationDocument({
      documentId: "note-1",
      persistence,
      provider,
    });
    await document.ready;

    const updates = seededUpdates();
    expect(deliverRemoteUpdate).toBeDefined();
    deliverRemoteUpdate!(updates.seed);
    document.applyLocalUpdate(updates.left);
    await document.flush();
    const persistenceWritesBeforeDestroy = persistence.persistCalls;
    const sentUpdatesBeforeDestroy = sentUpdates.length;

    const destroy = document.destroy();
    document.applyLocalUpdate(updates.right);
    deliverRemoteUpdate!(updates.right);
    await destroy;
    await document.destroy();

    expect(connection.destroyCalls).toBe(1);
    expect(persistence.destroyCalls).toBe(1);
    expect(document.connectionState()).toBe("disconnected");
    expect(readBody(document.exportState())).toBe("left-core");
    expect(persistence.persistCalls).toBe(persistenceWritesBeforeDestroy);
    expect(sentUpdates).toHaveLength(sentUpdatesBeforeDestroy);
  });

  it("retries only the adapter teardown that failed", async () => {
    const persistence = new MemoryPersistence();
    let providerDestroyCalls = 0;
    const document = createCollaborationDocument({
      documentId: "retry-destroy",
      persistence,
      provider: {
        connect() {
          return {
            send() {},
            async destroy() {
              providerDestroyCalls += 1;
              if (providerDestroyCalls === 1) {
                throw new Error("provider teardown failed");
              }
            },
          };
        },
      },
    });
    await document.ready;

    await expect(document.destroy()).rejects.toThrow(
      "provider teardown failed",
    );
    await expect(document.destroy()).resolves.toBeUndefined();

    expect(providerDestroyCalls).toBe(2);
    expect(persistence.destroyCalls).toBe(1);
  });

  it("waits for pending persistence restore before releasing the adapter", async () => {
    const persistence = new PendingRestorePersistence();
    let providerConnections = 0;
    const document = createCollaborationDocument({
      documentId: "note-1",
      persistence,
      provider: {
        connect() {
          providerConnections += 1;
          return { send() {}, destroy() {} };
        },
      },
    });

    const destroy = document.destroy();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(persistence.destroyCalls).toBe(0);
    expect(persistence.destroyedBeforeRestoreSettled).toBe(false);

    persistence.finishRestore(seededUpdates().seed);
    await document.ready;
    await destroy;

    expect(persistence.destroyCalls).toBe(1);
    expect(providerConnections).toBe(0);
    expect(readBody(document.exportState())).toBe("");
  });

  it("ignores provider callbacks that arrive while teardown is pending", async () => {
    const releaseConnection = deferred<void>();
    const sentUpdates: Uint8Array[] = [];
    let connectionDestroyCalls = 0;
    let deliverRemoteUpdate: ((update: Uint8Array) => void) | undefined;
    let setConnectionState:
      | ((state: "disconnected" | "connecting" | "connected") => void)
      | undefined;
    const document = createCollaborationDocument({
      documentId: "note-1",
      provider: {
        connect(options) {
          deliverRemoteUpdate = options.applyRemoteUpdate;
          setConnectionState = options.setConnectionState;
          options.setConnectionState("connected");
          return {
            send(update) {
              sentUpdates.push(update);
            },
            destroy() {
              connectionDestroyCalls += 1;
              return releaseConnection.promise;
            },
          };
        },
      },
    });
    await document.ready;

    const updates = seededUpdates();
    expect(deliverRemoteUpdate).toBeDefined();
    expect(setConnectionState).toBeDefined();
    deliverRemoteUpdate!(updates.seed);
    const sentUpdatesBeforeDestroy = sentUpdates.length;

    const destroy = document.destroy();
    setConnectionState!("connected");
    deliverRemoteUpdate!(updates.left);
    document.applyLocalUpdate(updates.right);

    expect(document.connectionState()).toBe("disconnected");
    expect(readBody(document.exportState())).toBe("core");
    expect(sentUpdates).toHaveLength(sentUpdatesBeforeDestroy);

    releaseConnection.resolve(undefined);
    await destroy;
    expect(connectionDestroyCalls).toBe(1);
  });
});
