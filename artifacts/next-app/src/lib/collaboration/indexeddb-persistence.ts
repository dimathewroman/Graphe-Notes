import { fetchUpdates, type IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import type { ErasableRevisionedCollaborationPersistenceAdapter } from "./collaboration-document";

const DATABASE_PREFIX = "graphe-collaboration:";
const AVAILABILITY_DATABASE = "graphe-collaboration-availability";
const UPDATES_STORE = "updates";
const CUSTOM_STORE = "custom";
const BASE_REVISION_KEY = "base-server-revision";
const REGISTRY_DATABASE = "graphe-collaboration-registry";
const REGISTRY_STORE = "replicas";

interface IndexeddbSession {
  document: Y.Doc;
  persistence: LocalIndexeddbProvider;
}

interface ReplicaRegistryRecord {
  documentId: string;
  scope: string;
}

function collaborationScope(documentId: string): string {
  if (/^graphe-yjs:v1:demo:note:\d+$/.test(documentId)) return "demo";
  const match = /^graphe-yjs:v1:user:([^:]+):note:\d+$/.exec(documentId);
  return match ? `authenticated:${match[1]}` : "unknown";
}

function replicaRecord(documentId: string): ReplicaRegistryRecord | null {
  const scope = collaborationScope(documentId);
  return scope === "unknown" ? null : { documentId, scope };
}

async function discoverStrictReplicaRecords(): Promise<
  ReplicaRegistryRecord[]
> {
  if (typeof globalThis.indexedDB.databases !== "function") return [];
  const databases = await globalThis.indexedDB.databases();
  return databases.flatMap((database) => {
    const name = database.name;
    if (!name?.startsWith(DATABASE_PREFIX)) return [];
    const record = replicaRecord(name.slice(DATABASE_PREFIX.length));
    return record ? [record] : [];
  });
}

function openRegistryDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.open(REGISTRY_DATABASE, 1);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(REGISTRY_STORE)) {
        request.result.createObjectStore(REGISTRY_STORE, {
          keyPath: "documentId",
        });
      }
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB registry is unavailable."));
    request.onsuccess = () => resolve(request.result);
  });
}

function completeRegistryTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  apply: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    try {
      transaction = database.transaction(REGISTRY_STORE, mode);
      apply(transaction.objectStore(REGISTRY_STORE));
    } catch (error) {
      reject(error);
      return;
    }
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("IndexedDB registry write failed."),
      );
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error("IndexedDB registry write failed."),
      );
    transaction.oncomplete = () => resolve();
  }).finally(() => database.close());
}

async function registerDocument(documentId: string): Promise<void> {
  const database = await openRegistryDatabase();
  await completeRegistryTransaction(database, "readwrite", (store) => {
    store.put({ documentId, scope: collaborationScope(documentId) });
  });
}

async function registeredDocuments(
  scope: string | null,
): Promise<ReplicaRegistryRecord[]> {
  const database = await openRegistryDatabase();
  return new Promise<ReplicaRegistryRecord[]>((resolve, reject) => {
    let transaction: IDBTransaction | undefined;
    try {
      transaction = database.transaction(REGISTRY_STORE, "readonly");
      const request = transaction.objectStore(REGISTRY_STORE).getAll();
      request.onsuccess = () => {
        const records = (request.result as ReplicaRegistryRecord[]).filter(
          (record) => {
            const expected = replicaRecord(record.documentId);
            return (
              expected !== null &&
              expected.scope === record.scope &&
              (scope === null || record.scope === scope)
            );
          },
        );
        resolve(records);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB registry read failed."));
    } catch (error) {
      reject(error);
    }
    if (transaction) {
      transaction.addEventListener("complete", () => database.close());
      transaction.addEventListener("abort", () => database.close());
    }
  });
}

async function removeRegisteredDocuments(documentIds: string[]): Promise<void> {
  if (documentIds.length === 0) return;
  const database = await openRegistryDatabase();
  await completeRegistryTransaction(database, "readwrite", (store) => {
    documentIds.forEach((documentId) => store.delete(documentId));
  });
}

function deleteDocumentDatabase(documentId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.deleteDatabase(
        `${DATABASE_PREFIX}${documentId}`,
      );
    } catch (error) {
      reject(error);
      return;
    }
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB deletion failed."));
    request.onblocked = () =>
      reject(new Error("IndexedDB deletion is blocked."));
  });
}

/** Deletes one exact app-generated replica; unrelated IndexedDB databases are never opened or deleted. */
export async function eraseDocument(documentId: string): Promise<void> {
  await deleteDocumentDatabase(documentId);
  await removeRegisteredDocuments([documentId]);
}

async function eraseScope(scope: string): Promise<void> {
  const records = [
    ...(await registeredDocuments(scope)),
    ...(await discoverStrictReplicaRecords()),
  ].filter((record) => record.scope === scope);
  const uniqueRecords = [
    ...new Map(records.map((record) => [record.documentId, record])).values(),
  ];
  await Promise.all(
    uniqueRecords.map((record) => deleteDocumentDatabase(record.documentId)),
  );
  await removeRegisteredDocuments(
    uniqueRecords.map((record) => record.documentId),
  );
}

export async function eraseAuthenticatedOwner(userId: string): Promise<void> {
  await eraseScope(`authenticated:${userId}`);
}

export async function eraseStaleAuthenticatedOwners(
  currentUserId: string,
): Promise<void> {
  const currentScope = `authenticated:${currentUserId}`;
  const records = [
    ...(await registeredDocuments(null)),
    ...(await discoverStrictReplicaRecords()),
  ].filter(
    (record) =>
      record.scope.startsWith("authenticated:") &&
      record.scope !== currentScope,
  );
  const uniqueRecords = [
    ...new Map(records.map((record) => [record.documentId, record])).values(),
  ];
  await Promise.all(
    uniqueRecords.map((record) => deleteDocumentDatabase(record.documentId)),
  );
  await removeRegisteredDocuments(
    uniqueRecords.map((record) => record.documentId),
  );
}

export async function eraseDemo(): Promise<void> {
  await eraseScope("demo");
}

export async function eraseAll(): Promise<void> {
  const records = [
    ...(await registeredDocuments(null)),
    ...(await discoverStrictReplicaRecords()),
  ];
  const uniqueRecords = [
    ...new Map(records.map((record) => [record.documentId, record])).values(),
  ];
  await Promise.all(
    uniqueRecords.map((record) => deleteDocumentDatabase(record.documentId)),
  );
  await removeRegisteredDocuments(
    uniqueRecords.map((record) => record.documentId),
  );
}

function verifyIndexeddbAvailability(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.open(AVAILABILITY_DATABASE);
    } catch (error) {
      reject(error);
      return;
    }

    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB is unavailable."));
    request.onsuccess = () => {
      request.result.close();
      try {
        const deletion = globalThis.indexedDB.deleteDatabase(
          AVAILABILITY_DATABASE,
        );
        deletion.onsuccess = () => resolve();
        deletion.onerror = () => resolve();
        deletion.onblocked = () => resolve();
      } catch {
        resolve();
      }
    };
  });
}

function openDocumentDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = globalThis.indexedDB.open(name);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(UPDATES_STORE)) {
        database.createObjectStore(UPDATES_STORE, { autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(CUSTOM_STORE)) {
        database.createObjectStore(CUSTOM_STORE);
      }
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB is unavailable."));
    request.onsuccess = () => {
      const database = request.result;
      let initialized = false;
      try {
        const updates = database
          .transaction(UPDATES_STORE, "readonly")
          .objectStore(UPDATES_STORE);
        const custom = database
          .transaction(CUSTOM_STORE, "readonly")
          .objectStore(CUSTOM_STORE);
        initialized =
          updates.autoIncrement &&
          updates.keyPath === null &&
          !custom.autoIncrement &&
          custom.keyPath === null;
      } catch {
        initialized = false;
      }

      if (!initialized) {
        database.close();
        reject(
          new Error(
            "IndexedDB collaboration database is missing required object stores.",
          ),
        );
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

function initializeDocumentDatabase(name: string): Promise<void> {
  return openDocumentDatabase(name).then((database) => database.close());
}

function appendPersistedState(
  database: IDBDatabase,
  state: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(UPDATES_STORE, "readwrite");
      const updates = transaction.objectStore(UPDATES_STORE);
      updates.add(state);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB write failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB write failed."));
    transaction.oncomplete = () => resolve();
  });
}

function readCustomValue(database: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(CUSTOM_STORE, "readonly");
      const request = transaction.objectStore(CUSTOM_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB read failed."));
    } catch (error) {
      reject(error);
    }
  });
}

function writeCustomValue(
  database: IDBDatabase,
  key: string,
  value: unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(CUSTOM_STORE, "readwrite");
      transaction.objectStore(CUSTOM_STORE).put(value, key);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB write failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB write failed."));
    transaction.oncomplete = () => resolve();
  });
}

class LocalIndexeddbProvider {
  readonly doc: Y.Doc;
  db: IDBDatabase | null = null;
  _dbref = 0;
  _dbsize = 0;
  _destroyed = false;
  readonly ready: Promise<void>;
  private destroyPromise: Promise<void> | undefined;

  constructor(name: string, document: Y.Doc) {
    this.doc = document;
    this.ready = openDocumentDatabase(name).then(async (database) => {
      this.db = database;
      // fetchUpdates only reads the provider fields implemented by this local wrapper.
      await fetchUpdates(this as unknown as IndexeddbPersistence);
    });
  }

  async persist(state: Uint8Array): Promise<void> {
    await this.ready;
    if (this._destroyed || !this.db) return;

    Y.applyUpdate(this.doc, state);
    await appendPersistedState(this.db, Y.encodeStateAsUpdate(this.doc));
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise;

    this._destroyed = true;
    this.destroyPromise = this.ready
      .catch(() => undefined)
      .then(() => this.db?.close());
    return this.destroyPromise;
  }
}

export function createIndexeddbCollaborationPersistence(): ErasableRevisionedCollaborationPersistenceAdapter {
  return new IndexeddbCollaborationPersistence();
}

class IndexeddbCollaborationPersistence implements ErasableRevisionedCollaborationPersistenceAdapter {
  private documentId: string | undefined;
  private session: IndexeddbSession | undefined;
  private sessionReady: Promise<IndexeddbSession> | undefined;
  private destroyed = false;
  private disabled = false;
  private destroyPromise: Promise<void> | undefined;

  async restore(documentId: string): Promise<Uint8Array | null> {
    const session = await this.getSession(documentId);
    return this.destroyed ? null : Y.encodeStateAsUpdate(session.document);
  }

  async persist(documentId: string, state: Uint8Array): Promise<void> {
    if (this.destroyed || this.disabled) return;

    const session = await this.getSession(documentId);
    if (!this.destroyed) await session.persistence.persist(state);
  }

  async restoreBaseRevision(documentId: string): Promise<string | null> {
    const session = await this.getSession(documentId);
    if (this.destroyed) return null;
    const value = await readCustomValue(
      session.persistence.db!,
      BASE_REVISION_KEY,
    );
    return typeof value === "string" ? value : null;
  }

  async persistBaseRevision(
    documentId: string,
    revision: string,
  ): Promise<void> {
    if (this.destroyed || this.disabled) return;
    const session = await this.getSession(documentId);
    if (!this.destroyed)
      await writeCustomValue(
        session.persistence.db!,
        BASE_REVISION_KEY,
        revision,
      );
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise;

    this.destroyed = true;
    this.destroyPromise = this.session
      ? Promise.resolve(this.session.persistence.destroy()).then(
          () => undefined,
        )
      : Promise.resolve();
    return this.destroyPromise;
  }

  async disableAndErase(): Promise<void> {
    if (this.disabled) return;
    this.disabled = true;
    const documentId = this.documentId;
    await this.destroy();
    if (documentId) await eraseDocument(documentId);
  }

  private getSession(documentId: string): Promise<IndexeddbSession> {
    if (this.destroyed || this.disabled)
      return Promise.reject(
        new Error("IndexedDB persistence has been destroyed."),
      );
    if (this.documentId && this.documentId !== documentId) {
      return Promise.reject(
        new Error("IndexedDB persistence supports one collaboration document."),
      );
    }
    if (this.sessionReady) return this.sessionReady;

    this.documentId = documentId;
    const databaseName = `${DATABASE_PREFIX}${documentId}`;
    this.sessionReady = verifyIndexeddbAvailability()
      .then(() => initializeDocumentDatabase(databaseName))
      .then(() => registerDocument(documentId))
      .then(() => {
        const document = new Y.Doc({ guid: documentId });
        const persistence = new LocalIndexeddbProvider(databaseName, document);
        const session = { document, persistence };
        this.session = session;
        return persistence.ready.then(() => session);
      });
    return this.sessionReady;
  }
}
