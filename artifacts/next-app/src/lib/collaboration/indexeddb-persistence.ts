import { fetchUpdates, type IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import type { CollaborationPersistenceAdapter } from "./collaboration-document";

const DATABASE_PREFIX = "graphe-collaboration:";
const AVAILABILITY_DATABASE = "graphe-collaboration-availability";
const UPDATES_STORE = "updates";
const CUSTOM_STORE = "custom";

interface IndexeddbSession {
  document: Y.Doc;
  persistence: LocalIndexeddbProvider;
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

    request.onerror = () => reject(request.error ?? new Error("IndexedDB is unavailable."));
    request.onsuccess = () => {
      request.result.close();
      try {
        const deletion = globalThis.indexedDB.deleteDatabase(AVAILABILITY_DATABASE);
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
    request.onerror = () => reject(request.error ?? new Error("IndexedDB is unavailable."));
    request.onsuccess = () => {
      const database = request.result;
      let initialized = false;
      try {
        const updates = database.transaction(UPDATES_STORE, "readonly").objectStore(UPDATES_STORE);
        const custom = database.transaction(CUSTOM_STORE, "readonly").objectStore(CUSTOM_STORE);
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
        reject(new Error("IndexedDB collaboration database is missing required object stores."));
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

function replacePersistedState(database: IDBDatabase, state: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(UPDATES_STORE, "readwrite");
      const updates = transaction.objectStore(UPDATES_STORE);
      updates.clear();
      updates.add(state);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write failed."));
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
    await replacePersistedState(this.db, Y.encodeStateAsUpdate(this.doc));
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

export function createIndexeddbCollaborationPersistence(): CollaborationPersistenceAdapter {
  return new IndexeddbCollaborationPersistence();
}

class IndexeddbCollaborationPersistence implements CollaborationPersistenceAdapter {
  private documentId: string | undefined;
  private session: IndexeddbSession | undefined;
  private sessionReady: Promise<IndexeddbSession> | undefined;
  private destroyed = false;
  private destroyPromise: Promise<void> | undefined;

  async restore(documentId: string): Promise<Uint8Array | null> {
    const session = await this.getSession(documentId);
    return this.destroyed ? null : Y.encodeStateAsUpdate(session.document);
  }

  async persist(documentId: string, state: Uint8Array): Promise<void> {
    if (this.destroyed) return;

    const session = await this.getSession(documentId);
    if (!this.destroyed) await session.persistence.persist(state);
  }

  destroy(): Promise<void> {
    if (this.destroyPromise) return this.destroyPromise;

    this.destroyed = true;
    this.destroyPromise = this.session
      ? Promise.resolve(this.session.persistence.destroy()).then(() => undefined)
      : Promise.resolve();
    return this.destroyPromise;
  }

  private getSession(documentId: string): Promise<IndexeddbSession> {
    if (this.destroyed) return Promise.reject(new Error("IndexedDB persistence has been destroyed."));
    if (this.documentId && this.documentId !== documentId) {
      return Promise.reject(new Error("IndexedDB persistence supports one collaboration document."));
    }
    if (this.sessionReady) return this.sessionReady;

    this.documentId = documentId;
    const databaseName = `${DATABASE_PREFIX}${documentId}`;
    this.sessionReady = verifyIndexeddbAvailability()
      .then(() => initializeDocumentDatabase(databaseName))
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
