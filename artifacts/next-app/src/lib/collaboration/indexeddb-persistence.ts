import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import type { CollaborationPersistenceAdapter } from "./collaboration-document";

const DATABASE_PREFIX = "graphe-collaboration:";
const AVAILABILITY_DATABASE = "graphe-collaboration-availability";
const UPDATES_STORE = "updates";
const CUSTOM_STORE = "custom";

interface IndexeddbSession {
  document: Y.Doc;
  persistence: IndexeddbPersistence;
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

function initializeDocumentDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(name);
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
      database.close();

      if (!initialized) {
        reject(new Error("IndexedDB collaboration database is missing required object stores."));
        return;
      }
      resolve();
    };
  });
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
    if (!this.destroyed) Y.applyUpdate(session.document, state);
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
        const persistence = new IndexeddbPersistence(databaseName, document);
        const session = { document, persistence };
        this.session = session;
        return persistence.whenSynced.then(() => session);
      });
    return this.sessionReady;
  }
}
