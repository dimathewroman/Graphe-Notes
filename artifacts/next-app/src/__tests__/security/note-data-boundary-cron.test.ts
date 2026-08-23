// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyCronAuth: vi.fn(),
  purgeNoteChildren: vi.fn(),
  cleanupExpiredUploadReservations: vi.fn(),
  captureException: vi.fn(),
  removeStorage: vi.fn(),
  db: { select: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronAuth: (...args: unknown[]) => mocks.verifyCronAuth(...args),
}));
vi.mock("@/lib/note-cleanup", () => ({
  purgeNoteChildren: (...args: unknown[]) => mocks.purgeNoteChildren(...args),
}));
vi.mock("@/lib/attachment-upload-reservation", () => ({
  cleanupExpiredUploadReservations: (...args: unknown[]) =>
    mocks.cleanupExpiredUploadReservations(...args),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    storage: { from: () => ({ remove: mocks.removeStorage }) },
  },
}));
vi.mock("@workspace/db", () => ({
  db: mocks.db,
  notesTable: { id: "id", autoDeleteAt: "autoDeleteAt" },
  attachmentsTable: {
    id: "id",
    storagePath: "storagePath",
    masterPath: "masterPath",
    proxyPath: "proxyPath",
    deletedAt: "deletedAt",
  },
}));

function query(result: unknown) {
  const value = Promise.resolve(result);
  return Object.assign(value, {
    from: () => query(result),
    where: () => query(result),
    limit: () => query(result),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyCronAuth.mockReturnValue({ ok: true });
  mocks.cleanupExpiredUploadReservations.mockResolvedValue({
    claimed: 0,
    cleaned: 0,
    failed: 0,
  });
  mocks.removeStorage.mockResolvedValue({ error: null });
  mocks.db.select.mockReturnValue(query([{ id: 1 }]));
});

describe("purge-deleted boundary", () => {
  it("does not delete candidate notes when attachment storage cleanup partially fails", async () => {
    mocks.db.select
      .mockReturnValueOnce(query([{ id: 1 }]))
      .mockReturnValueOnce(query([]));
    mocks.purgeNoteChildren.mockResolvedValue({
      complete: false,
      storageErrors: 1,
    });
    const { GET } = await import("@/app/api/cron/purge-deleted/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/purge-deleted"),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Cleanup incomplete; retry later",
      failures: ["note_child_cleanup"],
      storageErrors: 1,
    });
    expect(mocks.db.delete).not.toHaveBeenCalled();
    expect(mocks.cleanupExpiredUploadReservations).toHaveBeenCalledTimes(1);
  });

  it("does not delete candidate notes when a concurrent child remains after cleanup", async () => {
    mocks.db.select
      .mockReturnValueOnce(query([{ id: 1 }]))
      .mockReturnValueOnce(query([]));
    mocks.purgeNoteChildren.mockResolvedValue({
      complete: false,
      storageErrors: 0,
    });
    const { GET } = await import("@/app/api/cron/purge-deleted/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/purge-deleted"),
    );

    expect(response.status).toBe(503);
    expect(mocks.db.delete).not.toHaveBeenCalled();
    expect(mocks.cleanupExpiredUploadReservations).toHaveBeenCalledTimes(1);
  });

  it("runs reservation cleanup once when expired attachment Storage cleanup fails", async () => {
    mocks.purgeNoteChildren.mockResolvedValue({
      complete: true,
      storageErrors: 0,
    });
    mocks.db.select.mockReturnValueOnce(query([])).mockReturnValueOnce(
      query([
        {
          id: "attachment-1",
          storagePath: "synthetic-path",
          masterPath: null,
          proxyPath: null,
        },
      ]),
    );
    mocks.removeStorage.mockResolvedValue({
      error: { message: "synthetic outage" },
    });
    const { GET } = await import("@/app/api/cron/purge-deleted/route");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/purge-deleted"),
    );

    expect(response.status).toBe(503);
    expect(mocks.cleanupExpiredUploadReservations).toHaveBeenCalledTimes(1);
  });
});
