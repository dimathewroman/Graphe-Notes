import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { CollaborationPersistenceAdapter } from "@/lib/collaboration/collaboration-document";
import {
  createNoteCollaborationIdentity,
  createNoteCollaborationSession,
  type RevisionedCollaborationPersistence,
} from "@/lib/collaboration/note-collaboration-session";

const SERVER_REVISION = "2026-08-25T12:34:56.789Z";

class MemoryPersistence implements RevisionedCollaborationPersistence {
  private readonly states = new Map<string, Uint8Array>();
  private readonly baseRevisions = new Map<string, string>();
  persistedRevisions: string[] = [];

  async restore(documentId: string): Promise<Uint8Array | null> {
    return this.states.get(documentId) ?? null;
  }

  async persist(documentId: string, state: Uint8Array): Promise<void> {
    this.states.set(documentId, state);
  }

  async restoreBaseRevision(documentId: string): Promise<string | null> {
    return this.baseRevisions.get(documentId) ?? null;
  }

  async persistBaseRevision(
    documentId: string,
    revision: string,
  ): Promise<void> {
    this.baseRevisions.set(documentId, revision);
    this.persistedRevisions.push(`${documentId}:${revision}`);
  }

  async destroy(): Promise<void> {}
}

function insertDraft(document: Y.Doc, value: string) {
  const fragment = document.getXmlFragment("default");
  const paragraph = new Y.XmlElement("paragraph");
  const text = new Y.XmlText();
  text.insert(0, value);
  paragraph.insert(0, [text]);
  fragment.insert(0, [paragraph]);
}

describe("note collaboration session", () => {
  it("records the exact server revision only after the server baseline is persisted", async () => {
    const persistence = new MemoryPersistence();
    const identity = createNoteCollaborationIdentity({
      mode: "demo",
      noteId: "A",
    });
    const session = createNoteCollaborationSession({
      identity,
      serverRevision: SERVER_REVISION,
      persistence,
    });

    await expect(session.ready).resolves.toBe("server");
    insertDraft(session.yDocument, "server baseline");
    await session.recordAuthoritativeServerRevision(SERVER_REVISION);

    expect(persistence.persistedRevisions).toEqual([
      `${identity.documentId}:${SERVER_REVISION}`,
    ]);
    await session.destroy();
  });

  it("recovers a same-note local draft only when its persisted base exactly matches the server", async () => {
    const persistence = new MemoryPersistence();
    const identity = createNoteCollaborationIdentity({
      mode: "demo",
      noteId: "A",
    });
    const first = createNoteCollaborationSession({
      identity,
      serverRevision: SERVER_REVISION,
      persistence,
    });
    await first.ready;
    insertDraft(first.yDocument, "recover me");
    await first.recordAuthoritativeServerRevision(SERVER_REVISION);
    await first.destroy();

    const reopened = createNoteCollaborationSession({
      identity,
      serverRevision: SERVER_REVISION,
      persistence,
    });

    await expect(reopened.ready).resolves.toBe("local");
    expect(reopened.yDocument.getXmlFragment("default").length).toBeGreaterThan(
      0,
    );
    await reopened.destroy();
  });

  it("rejects a stale local draft and clears it before the server editor initializes", async () => {
    const persistence = new MemoryPersistence();
    const identity = createNoteCollaborationIdentity({
      mode: "demo",
      noteId: "A",
    });
    const first = createNoteCollaborationSession({
      identity,
      serverRevision: SERVER_REVISION,
      persistence,
    });
    await first.ready;
    insertDraft(first.yDocument, "stale draft");
    await first.recordAuthoritativeServerRevision(SERVER_REVISION);
    await first.destroy();

    const reopened = createNoteCollaborationSession({
      identity,
      serverRevision: "2026-08-25T12:34:57.000Z",
      persistence,
    });

    await expect(reopened.ready).resolves.toBe("server");
    expect(reopened.yDocument.getXmlFragment("default").length).toBe(0);
    await reopened.destroy();
  });

  it("fails closed to the server when an existing document has no persisted base revision", async () => {
    const persistence = new MemoryPersistence();
    const identity = createNoteCollaborationIdentity({
      mode: "demo",
      noteId: "A",
    });
    const first = createNoteCollaborationSession({
      identity,
      serverRevision: SERVER_REVISION,
      persistence,
    });
    await first.ready;
    insertDraft(first.yDocument, "unproven draft");
    await first.collaboration.flush();
    await first.destroy();

    const reopened = createNoteCollaborationSession({
      identity,
      serverRevision: SERVER_REVISION,
      persistence,
    });

    await expect(reopened.ready).resolves.toBe("server");
    expect(reopened.yDocument.getXmlFragment("default").length).toBe(0);
    await reopened.destroy();
  });

  it("keeps IndexedDB-compatible persistence behind the existing adapter boundary", () => {
    const adapter: CollaborationPersistenceAdapter = new MemoryPersistence();
    expect(adapter.destroy).toBeTypeOf("function");
  });
});
