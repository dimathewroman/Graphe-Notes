import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import {
  createCollaborationReplicaDisposition,
  eraseNoteCollaborationReplica,
  registerActiveCollaborationReplica,
  runReplicaProtectedBoundary,
  type CollaborationReplicaPersistence,
} from "@/lib/collaboration/note-collaboration-replica";
import { createNoteCollaborationIdentity } from "@/lib/collaboration/note-collaboration-lifecycle";

function createPersistence(): CollaborationReplicaPersistence {
  return {
    eraseDocument: vi.fn(async () => undefined),
    eraseAuthenticatedOwner: vi.fn(async () => undefined),
    eraseStaleAuthenticatedOwners: vi.fn(async () => undefined),
    eraseDemo: vi.fn(async () => undefined),
    eraseAll: vi.fn(async () => undefined),
  };
}

describe("collaboration replica disposition", () => {
  it("erases an active note before its exact local replica on permanent deletion", async () => {
    const persistence = createPersistence();
    const disposed = vi.fn(async () => undefined);
    const replicas = createCollaborationReplicaDisposition({
      persistence,
      disposeActive: disposed,
    });
    const identity = createNoteCollaborationIdentity({
      mode: "authenticated",
      userId: "owner-a",
      noteId: 4,
    });

    await replicas.eraseNote(identity);

    expect(disposed).toHaveBeenCalledWith(identity.documentId);
    expect(persistence.eraseDocument).toHaveBeenCalledWith(identity.documentId);
    expect(persistence.eraseAuthenticatedOwner).not.toHaveBeenCalled();
  });

  it("disposes only the leaving authenticated owner on logout or account change", async () => {
    const persistence = createPersistence();
    const disposed = vi.fn(async () => undefined);
    const replicas = createCollaborationReplicaDisposition({
      persistence,
      disposeActive: disposed,
    });

    await replicas.eraseAuthenticatedOwner("owner-a");

    expect(disposed).toHaveBeenCalledWith("authenticated:owner-a");
    expect(persistence.eraseAuthenticatedOwner).toHaveBeenCalledWith("owner-a");
    expect(persistence.eraseDemo).not.toHaveBeenCalled();
  });

  it("keeps demo isolated, clears it explicitly on demo exit, and clears every registered replica only for cache clear", async () => {
    const persistence = createPersistence();
    const disposed = vi.fn(async () => undefined);
    const replicas = createCollaborationReplicaDisposition({
      persistence,
      disposeActive: disposed,
    });

    await replicas.eraseDemo();
    expect(disposed).toHaveBeenLastCalledWith("demo");
    expect(persistence.eraseDemo).toHaveBeenCalledTimes(1);
    expect(persistence.eraseAuthenticatedOwner).not.toHaveBeenCalled();

    await replicas.clearAll();
    expect(disposed).toHaveBeenLastCalledWith("all");
    expect(persistence.eraseAll).toHaveBeenCalledTimes(1);
  });

  it("disposes stale authenticated owners before the current owner is activated", async () => {
    const persistence = createPersistence();
    const disposed = vi.fn(async () => undefined);
    const replicas = createCollaborationReplicaDisposition({
      persistence,
      disposeActive: disposed,
    });

    await replicas.eraseStaleAuthenticatedOwners("owner-b");

    expect(disposed).toHaveBeenCalledWith("authenticated-except:owner-b");
    expect(persistence.eraseStaleAuthenticatedOwners).toHaveBeenCalledWith(
      "owner-b",
    );
  });

  it("does not cross a protected identity or deletion boundary when cleanup fails", async () => {
    const order: string[] = [];
    const cleanup = vi.fn(async () => {
      order.push("cleanup");
      throw new Error("blocked");
    });
    const continueBoundary = vi.fn(async () => {
      order.push("continue");
    });

    await expect(
      runReplicaProtectedBoundary(cleanup, continueBoundary),
    ).rejects.toThrow("blocked");

    expect(order).toEqual(["cleanup"]);
    expect(continueBoundary).not.toHaveBeenCalled();
  });

  it("retains a failed active-editor teardown so protected cleanup can retry", async () => {
    const identity = createNoteCollaborationIdentity({
      mode: "demo",
      noteId: 987654,
    });
    let attempts = 0;
    const unregister = registerActiveCollaborationReplica(identity, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("teardown failed");
    });

    await expect(eraseNoteCollaborationReplica(identity)).rejects.toThrow(
      "teardown failed",
    );
    await expect(eraseNoteCollaborationReplica(identity)).resolves.toBeUndefined();

    expect(attempts).toBe(2);
    unregister();
  });
});
