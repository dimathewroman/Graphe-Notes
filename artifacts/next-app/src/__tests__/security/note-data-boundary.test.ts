// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  hasValidVaultProof: vi.fn(),
  captureException: vi.fn(),
  createSignedUrl: vi.fn(),
  removeStorage: vi.fn(),
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mocks.getAuthUser(...args),
}));
vi.mock("@/lib/vault-proof", () => ({
  hasValidVaultProof: (...args: unknown[]) => mocks.hasValidVaultProof(...args),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: mocks.createSignedUrl,
        remove: mocks.removeStorage,
      }),
    },
  },
}));
vi.mock("@workspace/db", () => ({
  db: mocks.db,
  notesTable: { id: "id", userId: "userId", vaulted: "vaulted" },
  foldersTable: { userId: "userId" },
  noteVersionsTable: { id: "id", noteId: "noteId", createdAt: "createdAt" },
  attachmentsTable: {
    id: "id",
    noteId: "noteId",
    userId: "userId",
    deletedAt: "deletedAt",
    storagePath: "storagePath",
    proxyPath: "proxyPath",
    masterPath: "masterPath",
  },
}));

function query(result: unknown) {
  const value = Promise.resolve(result);
  return Object.assign(value, {
    from: () => query(result),
    innerJoin: () => query(result),
    where: () => query(result),
    limit: () => query(result),
    orderBy: () => query(result),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ user: { id: "synthetic-owner" } });
  mocks.hasValidVaultProof.mockResolvedValue(false);
  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "synthetic-url" },
    error: null,
  });
  mocks.removeStorage.mockResolvedValue({ error: null });
});

describe("note data boundary", () => {
  it("does not mutate a vaulted note without its owner's valid proof", async () => {
    mocks.db.select.mockReturnValue(query([{ id: 1, vaulted: true }]));
    mocks.db.update.mockReturnValue({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    });

    const { PATCH } = await import("@/app/api/notes/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/notes/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "replacement" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("does not list a vaulted note's version metadata without its owner's valid proof", async () => {
    mocks.db.select.mockReturnValue(query([{ id: 1, vaulted: true }]));

    const { GET } = await import("@/app/api/notes/[id]/versions/route");
    const response = await GET(
      new NextRequest("http://localhost/api/notes/1/versions"),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("does not sign an attachment belonging to a vaulted note without its owner's valid proof", async () => {
    mocks.db.select.mockReturnValue(
      query([
        {
          storagePath: "synthetic-path",
          proxyPath: null,
          masterPath: null,
          vaulted: true,
        },
      ]),
    );

    const { GET } = await import("@/app/api/attachments/sign/route");
    const response = await GET(
      new NextRequest("http://localhost/api/attachments/sign?id=attachment-1"),
    );

    expect(response.status).toBe(403);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("does not offer an unconfirmed hard-delete route", async () => {
    mocks.db.delete.mockReturnValue({
      where: () => ({ returning: () => Promise.resolve([{ id: 1 }]) }),
    });

    const { DELETE } = await import("@/app/api/notes/[id]/route");
    const response = await DELETE(
      new NextRequest("http://localhost/api/notes/1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(405);
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it("retains attachment rows when storage cleanup fails so a later purge can retry", async () => {
    mocks.db.select.mockReturnValue(
      query([
        { storagePath: "synthetic-path", proxyPath: null, masterPath: null },
      ]),
    );
    mocks.db.delete.mockReturnValue({
      where: () => ({
        returning: () => Promise.resolve([{ storagePath: "synthetic-path" }]),
      }),
    });
    mocks.removeStorage.mockResolvedValue({
      error: { message: "synthetic storage outage" },
    });

    const { purgeNoteChildren } = await import("@/lib/note-cleanup");
    const result = await purgeNoteChildren([1]);

    expect(result).toEqual({ complete: false, storageErrors: 1 });
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });

  it("does not delete a parent note when child cleanup is incomplete", async () => {
    mocks.db.select
      .mockReturnValueOnce(query([{ id: 1, vaulted: false }]))
      .mockReturnValueOnce(
        query([
          { storagePath: "synthetic-path", proxyPath: null, masterPath: null },
        ]),
      );
    mocks.db.delete.mockReturnValue({ where: () => Promise.resolve([]) });
    mocks.removeStorage.mockResolvedValue({
      error: { message: "synthetic storage outage" },
    });

    const { DELETE } = await import("@/app/api/notes/[id]/permanent/route");
    const response = await DELETE(
      new NextRequest("http://localhost/api/notes/1/permanent", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(503);
    expect(mocks.db.delete).not.toHaveBeenCalled();
  });
});
