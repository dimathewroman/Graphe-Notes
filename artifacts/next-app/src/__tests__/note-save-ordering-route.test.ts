// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  canAccessVaultedNote: vi.fn(),
  captureException: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mocks.getAuthUser(...args),
}));
vi.mock("@/lib/vault-note-authorization", () => ({
  canAccessVaultedNote: (...args: unknown[]) =>
    mocks.canAccessVaultedNote(...args),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("@workspace/db", () => ({
  db: mocks.db,
  notesTable: {
    id: "id",
    userId: "userId",
    vaulted: "vaulted",
    updatedAt: "updatedAt",
    saveSessionId: "saveSessionId",
    saveSequence: "saveSequence",
  },
  foldersTable: { userId: "userId" },
}));

function query(result: unknown) {
  const value = Promise.resolve(result);
  return Object.assign(value, {
    from: () => query(result),
    where: () => query(result),
    limit: () => query(result),
  });
}

const ordering = {
  baseRevision: "2026-08-26T01:02:03.456Z",
  saveSessionId: "11111111-1111-4111-8111-111111111111",
  saveSequence: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ user: { id: "owner-1" } });
  mocks.canAccessVaultedNote.mockResolvedValue(true);
  mocks.db.select.mockReturnValue(query([{ id: 1, vaulted: false }]));
  mocks.db.update.mockReturnValue({
    set: (payload: unknown) => ({
      where: () => ({ returning: () => Promise.resolve([]), payload }),
    }),
  });
});

describe("note save ordering route", () => {
  it("fails closed for a legacy content client before attempting an update", async () => {
    const { PATCH } = await import("@/app/api/notes/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/notes/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "legacy overwrite" }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "note_save_conflict",
      reason: "ordering_required",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("returns a typed conflict when the single conditional update matches no row", async () => {
    const { PATCH } = await import("@/app/api/notes/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/notes/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "delayed A1", ...ordering }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "note_save_conflict",
      reason: "stale_or_cross_session",
    });
    expect(mocks.db.update).toHaveBeenCalledTimes(1);
  });

  it("rejects a fractional sequence before the conditional update", async () => {
    const { PATCH } = await import("@/app/api/notes/[id]/route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/notes/1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "invalid sequence",
          ...ordering,
          saveSequence: 1.5,
        }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Save sequence must be a non-negative safe integer",
    });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });
});
