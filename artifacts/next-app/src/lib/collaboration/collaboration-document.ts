import * as Y from "yjs";

export interface CollaborationDocumentOptions {
  documentId: string;
  persistence?: CollaborationPersistenceAdapter;
  provider?: CollaborationProviderAdapter;
}

export interface CollaborationPersistenceAdapter {
  restore(documentId: string): Promise<Uint8Array | null>;
  persist(documentId: string, state: Uint8Array): Promise<void>;
  destroy(): void | Promise<void>;
}

export type CollaborationConnectionState = "disconnected" | "connecting" | "connected";

export interface CollaborationProviderAdapter {
  connect(options: CollaborationProviderConnectOptions): CollaborationProviderConnection;
}

export interface CollaborationProviderConnectOptions {
  documentId: string;
  applyRemoteUpdate(update: Uint8Array): void;
  setConnectionState(state: CollaborationConnectionState): void;
}

export interface CollaborationProviderConnection {
  send(update: Uint8Array): void;
  destroy(): void | Promise<void>;
}

export interface CollaborationDocument {
  readonly ready: Promise<void>;
  applyLocalUpdate(update: Uint8Array): void;
  applyRemoteUpdate(update: Uint8Array): void;
  exportState(): Uint8Array;
  flush(): Promise<void>;
  connectionState(): CollaborationConnectionState;
  destroy(): Promise<void>;
}

const LOCAL_UPDATE_ORIGIN = Symbol("local-collaboration-update");
const REMOTE_UPDATE_ORIGIN = Symbol("remote-collaboration-update");
const RESTORE_UPDATE_ORIGIN = Symbol("restored-collaboration-state");

export function createCollaborationDocument({
  documentId,
  persistence,
  provider,
}: CollaborationDocumentOptions): CollaborationDocument {
  const document = new Y.Doc({ guid: documentId });
  let persisted = Promise.resolve();
  let connection: CollaborationProviderConnection | undefined;
  let connectionState: CollaborationConnectionState = "disconnected";
  let destroyed = false;
  let destroyPromise: Promise<void> | undefined;
  let finalState: Uint8Array | undefined;

  const applyRemoteUpdate = (update: Uint8Array) => {
    if (destroyed) return;
    Y.applyUpdate(document, update, REMOTE_UPDATE_ORIGIN);
  };

  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === LOCAL_UPDATE_ORIGIN) connection?.send(update);
    if (persistence && origin !== RESTORE_UPDATE_ORIGIN) {
      const state = Y.encodeStateAsUpdate(document);
      persisted = persisted.catch(() => undefined).then(() => persistence.persist(documentId, state));
    }
  };
  document.on("update", onUpdate);

  const restored = persistence
    ? persistence.restore(documentId).then((state) => {
        if (!destroyed && state) Y.applyUpdate(document, state, RESTORE_UPDATE_ORIGIN);
      })
    : Promise.resolve();
  const ready = restored.then(() => {
    if (destroyed || !provider) return;
    connection = provider.connect({
      documentId,
      applyRemoteUpdate,
      setConnectionState(state) {
        connectionState = state;
      },
    });
  });

  return {
    ready,
    applyLocalUpdate(update) {
      if (destroyed) return;
      Y.applyUpdate(document, update, LOCAL_UPDATE_ORIGIN);
    },
    applyRemoteUpdate(update) {
      applyRemoteUpdate(update);
    },
    exportState() {
      return finalState ?? Y.encodeStateAsUpdate(document);
    },
    flush() {
      return persisted;
    },
    connectionState() {
      return connectionState;
    },
    destroy() {
      if (destroyPromise) return destroyPromise;

      destroyed = true;
      connectionState = "disconnected";
      finalState = Y.encodeStateAsUpdate(document);
      document.off("update", onUpdate);
      document.destroy();

      const providerConnection = connection;
      destroyPromise = Promise.all([
        providerConnection ? Promise.resolve().then(() => providerConnection.destroy()) : undefined,
        persistence
          ? persisted.finally(() => persistence.destroy())
          : undefined,
      ]).then(() => undefined);
      return destroyPromise;
    },
  };
}
