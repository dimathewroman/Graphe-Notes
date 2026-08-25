import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createCollaborationDocument,
  type CollaborationProviderAdapter,
  type CollaborationPersistenceAdapter,
} from "@/lib/collaboration/collaboration-document";

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

describe("collaboration document", () => {
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
});
