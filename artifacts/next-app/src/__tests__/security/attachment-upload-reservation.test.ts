// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  remove: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock("crypto", () => ({ randomUUID: mocks.randomUUID }));
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args }),
  eq: (...args: unknown[]) => ({ eq: args }),
  inArray: (...args: unknown[]) => ({ inArray: args }),
  or: (...args: unknown[]) => ({ or: args }),
  sql: Object.assign(
    (parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }),
    {
      raw: (value: string) => value,
    },
  ),
}));
vi.mock("@workspace/db", () => ({
  db: {
    execute: mocks.execute,
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
    delete: mocks.delete,
    transaction: mocks.transaction,
  },
  attachmentUploadReservationsTable: {
    id: "reservation.id",
    leaseToken: "reservation.leaseToken",
    leaseExpiresAt: "reservation.leaseExpiresAt",
  },
  attachmentsTable: {
    storagePath: "attachment.storagePath",
    masterPath: "attachment.masterPath",
    proxyPath: "attachment.proxyPath",
  },
  notesTable: {
    id: "note.id",
    userId: "note.userId",
    deletedAt: "note.deletedAt",
    autoDeleteAt: "note.autoDeleteAt",
  },
}));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { storage: { from: () => ({ remove: mocks.remove }) } },
}));

function chain(result: unknown) {
  const promise = Promise.resolve(result);
  return Object.assign(promise, {
    values: () => chain(result),
    returning: () => chain(result),
    set: () => chain(result),
    where: () => chain(result),
    from: () => chain(result),
    limit: () => chain(result),
  });
}

const draft = {
  noteId: 42,
  userId: "user-1",
  fileName: "safe.txt",
  fileType: "text/plain",
  fileSize: 4,
  storagePath: "user-1/42/object",
};
const reservation = { id: "reservation-1", leaseToken: "lease-1" };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.randomUUID
    .mockReturnValueOnce("reservation-1")
    .mockReturnValueOnce("lease-1");
  mocks.insert.mockReturnValue(chain(undefined));
  mocks.update.mockReturnValue(chain([{ id: "reservation-1" }]));
  mocks.delete.mockReturnValue(chain([{ id: "reservation-1" }]));
  mocks.select.mockReturnValue(chain([]));
  mocks.remove.mockResolvedValue({ error: null });
});

describe("durable attachment upload reservation", () => {
  it("creates a durable reservation before the route's first Storage write", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/attachments/upload/route.ts"),
      "utf8",
    );
    expect(route.indexOf("createUploadReservation(draft)")).toBeLessThan(
      route.indexOf(".upload("),
    );
  });

  it("persists app-generated identity, paths, and a one-hour lease before Storage can run", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const { createUploadReservation, UPLOAD_RESERVATION_LEASE_MS } =
      await import("@/lib/attachment-upload-reservation");

    await expect(createUploadReservation(draft)).resolves.toEqual({
      ...reservation,
      leaseExpiresAt: new Date(now + 3_600_000),
    });
    expect(UPLOAD_RESERVATION_LEASE_MS).toBe(3_600_000);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("claims only database-selected expired rows with one rotated token and SKIP LOCKED", async () => {
    mocks.execute.mockResolvedValue({
      rows: [{ id: "stale", leaseToken: "new-token", retryCount: 0 }],
    });
    mocks.randomUUID.mockReset().mockReturnValue("new-token");
    const { claimExpiredUploadReservations } =
      await import("@/lib/attachment-upload-reservation");

    await expect(claimExpiredUploadReservations(12)).resolves.toHaveLength(1);
    const query = mocks.execute.mock.calls[0]![0] as { parts: string[] };
    expect(query.parts.join(" ")).toContain("for update skip locked");
    expect(query.parts.join(" ")).toContain("lease_expires_at <= now()");
  });

  it("deduplicates paths and excludes every path referenced by a completed attachment", async () => {
    mocks.select.mockReturnValue(
      chain([{ storagePath: null, masterPath: "shared", proxyPath: "shared" }]),
    );
    const { cleanupClaimedUploadReservation } =
      await import("@/lib/attachment-upload-reservation");

    await expect(
      cleanupClaimedUploadReservation({
        ...reservation,
        storagePath: null,
        masterPath: "shared",
        proxyPath: "orphan",
        retryCount: 0,
      }),
    ).resolves.toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith(["orphan"]);
    expect(mocks.delete).toHaveBeenCalledTimes(1);
  });

  it("keeps the durable row and schedules an unbounded later retry when Storage removal fails", async () => {
    mocks.remove.mockResolvedValue({
      error: { message: "provider unavailable" },
    });
    const { cleanupClaimedUploadReservation } =
      await import("@/lib/attachment-upload-reservation");

    await expect(
      cleanupClaimedUploadReservation({
        ...reservation,
        storagePath: "orphan",
        masterPath: null,
        proxyPath: null,
        retryCount: 99,
      }),
    ).resolves.toBe(false);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it("treats missing objects as successful cleanup and consumes the row with the current token", async () => {
    mocks.remove.mockResolvedValue({ error: null });
    const { cleanupClaimedUploadReservation } =
      await import("@/lib/attachment-upload-reservation");
    await expect(
      cleanupClaimedUploadReservation({
        ...reservation,
        storagePath: "already-missing",
        masterPath: null,
        proxyPath: null,
        retryCount: 2,
      }),
    ).resolves.toBe(true);
    expect(mocks.delete).toHaveBeenCalledTimes(1);
  });

  it("fails a stale finalizer before it can insert an attachment", async () => {
    const tx = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    const { finalizeUploadReservation, UploadReservationError } =
      await import("@/lib/attachment-upload-reservation");

    await expect(finalizeUploadReservation(reservation, draft)).rejects.toEqual(
      new UploadReservationError("reservation_unavailable"),
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("atomically inserts the attachment and consumes the current reservation", async () => {
    const committed = { id: "attachment-1", ...draft };
    const tx = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: reservation.id }] }),
      select: vi.fn().mockReturnValue(chain([{ id: draft.noteId }])),
      insert: vi.fn().mockReturnValue(chain([committed])),
      delete: vi.fn().mockReturnValue(chain([{ id: reservation.id }])),
    };
    mocks.transaction.mockImplementation((callback) => callback(tx));
    const { finalizeUploadReservation } =
      await import("@/lib/attachment-upload-reservation");

    await expect(
      finalizeUploadReservation(reservation, draft),
    ).resolves.toEqual(committed);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(tx.delete).toHaveBeenCalledTimes(1);
  });
});
