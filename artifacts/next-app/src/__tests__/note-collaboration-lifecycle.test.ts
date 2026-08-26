import { describe, expect, it } from "vitest";
import {
  createNoteCollaborationIdentity,
  createNoteCollaborationLifecycleCoordinator,
  getNoteCollaborationPersistencePolicy,
  isCurrentNoteLifecycleSource,
  shouldRestoreLocalDraft,
  type NoteCollaborationSession,
} from "@/lib/collaboration/note-collaboration-lifecycle";

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("note collaboration identity", () => {
  it("isolates authenticated users and notes without using note content or titles", () => {
    const ownerOneNoteOne = createNoteCollaborationIdentity({
      mode: "authenticated",
      userId: "user-one",
      noteId: 7,
    });
    const ownerTwoNoteOne = createNoteCollaborationIdentity({
      mode: "authenticated",
      userId: "user-two",
      noteId: 7,
    });
    const ownerOneNoteTwo = createNoteCollaborationIdentity({
      mode: "authenticated",
      userId: "user-one",
      noteId: 8,
    });
    const demoNoteOne = createNoteCollaborationIdentity({
      mode: "demo",
      noteId: 7,
    });

    expect(ownerOneNoteOne.documentId).not.toBe(ownerTwoNoteOne.documentId);
    expect(ownerOneNoteOne.documentId).not.toBe(ownerOneNoteTwo.documentId);
    expect(demoNoteOne.documentId).not.toBe(ownerOneNoteOne.documentId);
    expect(demoNoteOne.documentId).toBe("graphe-yjs:v1:demo:note:7");
    expect(ownerOneNoteOne.documentId).not.toContain("title");
    expect(ownerOneNoteOne.documentId).not.toContain("content");
    expect(ownerOneNoteOne.documentId).not.toContain("@");
  });

  it("rejects an authenticated identity without an opaque owner id", () => {
    expect(() =>
      createNoteCollaborationIdentity({
        mode: "authenticated",
        userId: "",
        noteId: 7,
      }),
    ).toThrow("owner id");
  });
});

describe("server-first local draft recovery", () => {
  const serverRevision = "2026-08-25T12:34:56.789Z";

  it("permits recovery only when a local draft is owned by the exact server revision", () => {
    expect(
      shouldRestoreLocalDraft({
        hasLocalDraft: true,
        persistedBaseRevision: serverRevision,
        serverRevision,
      }),
    ).toBe(true);
  });

  it.each([
    ["changed server revision", "2026-08-25T12:34:57.000Z", serverRevision],
    ["missing cache revision", null, serverRevision],
    ["missing server revision", serverRevision, null],
    ["malformed cache revision", "not-a-server-revision", serverRevision],
    ["malformed server revision", serverRevision, "later"],
  ])("fails closed for %s", (_reason, persistedBaseRevision, revision) => {
    expect(
      shouldRestoreLocalDraft({
        hasLocalDraft: true,
        persistedBaseRevision,
        serverRevision: revision,
      }),
    ).toBe(false);
  });

  it("does not recover an empty local document even with a matching base revision", () => {
    expect(
      shouldRestoreLocalDraft({
        hasLocalDraft: false,
        persistedBaseRevision: serverRevision,
        serverRevision,
      }),
    ).toBe(false);
  });
});

describe("local collaboration pilot eligibility", () => {
  it("never initializes or recovers a vaulted note, whether it is locked or unlocked", () => {
    expect(
      getNoteCollaborationPersistencePolicy({
        vaulted: true,
        content: "",
      }),
    ).toEqual({ enabled: false, eraseExistingReplica: true });
    expect(
      getNoteCollaborationPersistencePolicy({
        vaulted: true,
        content: "<p>decrypted editor content</p>",
      }),
    ).toEqual({ enabled: false, eraseExistingReplica: true });
  });

  it("fails closed for attachment-bearing content instead of persisting attachment metadata", () => {
    expect(
      getNoteCollaborationPersistencePolicy({
        vaulted: false,
        content:
          '<p>text</p><img src="https://signed.example/file" alt="private-name.png" data-master-path="private/path" />',
      }),
    ).toEqual({ enabled: false, eraseExistingReplica: true });
    expect(
      getNoteCollaborationPersistencePolicy({
        vaulted: false,
        content:
          '<p>text</p><div data-type="imageUpload" data-file-name="private-name.png" />',
      }),
    ).toEqual({ enabled: false, eraseExistingReplica: true });
    expect(
      getNoteCollaborationPersistencePolicy({
        vaulted: false,
        content: "<p>plain note</p>",
      }),
    ).toEqual({ enabled: true, eraseExistingReplica: false });
  });
});

describe("note collaboration lifecycle coordinator", () => {
  it("fences A before B activates and disposes a late A activation", async () => {
    const destroyA = deferred<void>();
    const created: NoteCollaborationSession[] = [];
    const coordinator = createNoteCollaborationLifecycleCoordinator(
      (identity) => {
        const session: NoteCollaborationSession = {
          identity,
          destroy: async () => {
            if (identity.noteId === "A") await destroyA.promise;
          },
        };
        created.push(session);
        return session;
      },
    );

    const activeA = await coordinator.activate({ mode: "demo", noteId: "A" });
    expect(activeA?.identity.noteId).toBe("A");

    const activateB = coordinator.activate({ mode: "demo", noteId: "B" });
    expect(coordinator.current()).toBeNull();

    destroyA.resolve();
    const activeB = await activateB;

    expect(activeB?.identity.noteId).toBe("B");
    expect(coordinator.current()?.identity.noteId).toBe("B");
    expect(created).toHaveLength(2);
  });

  it("does not let a destroyed note authorize a save for the active note", async () => {
    const coordinator = createNoteCollaborationLifecycleCoordinator(
      (identity) => ({
        identity,
        destroy: async () => undefined,
      }),
    );

    const activeA = await coordinator.activate({ mode: "demo", noteId: "A" });
    const activeB = await coordinator.activate({ mode: "demo", noteId: "B" });

    expect(coordinator.isCurrent(activeA!)).toBe(false);
    expect(coordinator.isCurrent(activeB!)).toBe(true);
  });

  it("fences a rapid A → B → A sequence before the final A becomes active", async () => {
    const destroyA = deferred<void>();
    const created: string[] = [];
    const coordinator = createNoteCollaborationLifecycleCoordinator(
      (identity) => {
        created.push(String(identity.noteId));
        return {
          identity,
          destroy: async () => {
            if (identity.noteId === "A") await destroyA.promise;
          },
        };
      },
    );

    await coordinator.activate({ mode: "demo", noteId: "A" });
    const activateB = coordinator.activate({ mode: "demo", noteId: "B" });
    const activateFinalA = coordinator.activate({ mode: "demo", noteId: "A" });

    destroyA.resolve();
    await expect(activateB).resolves.toBeNull();
    await expect(activateFinalA).resolves.toMatchObject({
      identity: { noteId: "A" },
    });
    expect(created).toEqual(["A", "A"]);
  });

  it("fails closed when teardown fails instead of activating the next note", async () => {
    const created: string[] = [];
    let destroyAttempts = 0;
    const coordinator = createNoteCollaborationLifecycleCoordinator(
      (identity) => {
        created.push(String(identity.noteId));
        return {
          identity,
          destroy: async () => {
            destroyAttempts += 1;
            if (identity.noteId === "A" && destroyAttempts === 1)
              throw new Error("persistence teardown failed");
          },
        };
      },
    );

    await coordinator.activate({ mode: "demo", noteId: "A" });
    await expect(
      coordinator.activate({ mode: "demo", noteId: "B" }),
    ).rejects.toThrow("teardown failed");
    expect(created).toEqual(["A"]);
    expect(coordinator.current()).toBeNull();

    await expect(coordinator.destroy()).resolves.toBeUndefined();
    expect(destroyAttempts).toBe(2);
    expect(coordinator.current()).toBeNull();
  });

  it("makes destruction idempotent", async () => {
    let destroyCalls = 0;
    const coordinator = createNoteCollaborationLifecycleCoordinator(
      (identity) => ({
        identity,
        destroy: async () => {
          destroyCalls += 1;
        },
      }),
    );
    await coordinator.activate({ mode: "demo", noteId: "A" });

    const first = coordinator.destroy();
    const second = coordinator.destroy();
    expect(second).toBe(first);
    await first;

    expect(destroyCalls).toBe(1);
    expect(coordinator.current()).toBeNull();
  });
});

describe("note lifecycle callback fence", () => {
  it("rejects an old note's autosave, AI, and upload callbacks", () => {
    expect(isCurrentNoteLifecycleSource(1, 2)).toBe(false);
    expect(isCurrentNoteLifecycleSource(2, 2)).toBe(true);
    expect(isCurrentNoteLifecycleSource(undefined, 2)).toBe(true);
  });
});
