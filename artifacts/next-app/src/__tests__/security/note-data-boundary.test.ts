// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  hasValidVaultProof: vi.fn(),
  canAccessVaultedNote: vi.fn(),
  captureException: vi.fn(),
  createSignedUrl: vi.fn(),
  removeStorage: vi.fn(),
  uploadStorage: vi.fn(),
  createUploadReservation: vi.fn(),
  finalizeUploadReservation: vi.fn(),
  cleanupFailedUpload: vi.fn(),
  db: {
    select: vi.fn(),
    insert: vi.fn(),
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
vi.mock("@/lib/vault-note-authorization", () => ({
  canAccessVaultedNote: (...args: unknown[]) =>
    mocks.canAccessVaultedNote(...args),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: mocks.createSignedUrl,
        remove: mocks.removeStorage,
        upload: mocks.uploadStorage,
      }),
    },
  },
}));
vi.mock("@/lib/attachment-upload-reservation", () => {
  class UploadReservationError extends Error {
    constructor(readonly code: "reservation_unavailable" | "note_unavailable") {
      super(code);
    }
  }
  return {
    UploadReservationError,
    createUploadReservation: (...args: unknown[]) =>
      mocks.createUploadReservation(...args),
    finalizeUploadReservation: (...args: unknown[]) =>
      mocks.finalizeUploadReservation(...args),
    cleanupFailedUpload: (...args: unknown[]) =>
      mocks.cleanupFailedUpload(...args),
  };
});
vi.mock("@workspace/db", () => ({
  db: mocks.db,
  notesTable: {
    id: "id",
    userId: "userId",
    vaulted: "vaulted",
    deletedAt: "deletedAt",
    autoDeleteAt: "autoDeleteAt",
    title: "title",
    content: "content",
  },
  foldersTable: { userId: "userId" },
  usersTable: { id: "id", storageTier: "storageTier" },
  noteVersionsTable: { id: "id", noteId: "noteId", createdAt: "createdAt" },
  attachmentsTable: {
    id: "id",
    noteId: "noteId",
    userId: "userId",
    deletedAt: "deletedAt",
    storagePath: "storagePath",
    proxyPath: "proxyPath",
    masterPath: "masterPath",
    fileName: "fileName",
    fileType: "fileType",
    fileSize: "fileSize",
    masterFormat: "masterFormat",
    createdAt: "createdAt",
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function uploadForm() {
  const form = new FormData();
  form.set("note_id", "1");
  form.set(
    "file",
    new File(["synthetic"], "PRIVATE-FILENAME.txt", { type: "text/plain" }),
  );
  return form;
}

function mockUploadParent() {
  mocks.db.select
    .mockReturnValueOnce(
      query([{ id: 1, deletedAt: null, autoDeleteAt: null }]),
    )
    .mockReturnValueOnce(query([{ storageTier: "admin" }]));
}

// 3×2 HEIC encoded with libheif. Keeping this tiny real fixture inline makes
// the route test independent of host HEVC encoder availability.
const HEIC_FIXTURE_BASE64 =
  "AAAAGGZ0eXBoZWljAAAAAG1pZjFoZWljAAABem1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAHBpY3QAAAAAAAAAAAAAAAAAAAAAImlsb2MAAAAAREAAAQABAAAAAAGaAAEAAAAAAAAAMwAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGh2YzEAAAAADnBpdG0AAAAAAAEAAAD6aXBycAAAANppcGNvAAAAdWh2Y0MBA3AAAAAAAAAAAAAe8AD8/fj4AAAPA2AAAQAYQAEMAf//A3AAAAMAkAAAAwAAAwAeugJAYQABAClCAQEDcAAAAwCQAAADAAADAB6gIIEFluqumubgIaDAgAAADIAAAAMAhGIAAQAGRAHBc8GJAAAAE2NvbHJuY2x4AAEADQAGgAAAABRpc3BlAAAAAAAAAEAAAABAAAAAKGNsYXAAAAADAAAAAQAAAAIAAAAB////wwAAAAL////CAAAAAgAAAA5waXhpAAAAAAEIAAAAGGlwbWEAAAAAAAAAAQABBYECAwWEAAAAO21kYXQAAAAvKAGvEyFkY0D4EPdn//UpFsGlAj9/senOyEdAwNIggJtASJNdUAsWEICHdqVW3Pg=";

async function syntheticImageFile(
  format: "jpeg" | "png" | "webp" | "avif" | "heic",
  name: string,
  type: string,
): Promise<File> {
  if (format === "heic") {
    return new File(
      [Uint8Array.from(Buffer.from(HEIC_FIXTURE_BASE64, "base64"))],
      name,
      { type },
    );
  }
  const source = sharp({
    create: {
      width: 3,
      height: 2,
      channels: 3,
      background: { r: 20, g: 40, b: 60 },
    },
  });
  const bytes = await source.toFormat(format).toBuffer();
  return new File([Uint8Array.from(bytes)], name, { type });
}

async function uploadImage(file: File) {
  mockUploadParent();
  const stored: Array<{
    path: string;
    bytes: Buffer;
    contentType: string | undefined;
  }> = [];
  mocks.uploadStorage.mockImplementation(
    async (
      path: string,
      bytes: Buffer,
      options: { contentType?: string },
    ) => {
      stored.push({ path, bytes, contentType: options.contentType });
      return { error: null };
    },
  );
  mocks.finalizeUploadReservation.mockImplementation(
    async (_reservation, draft) => ({
      id: "canonical-attachment",
      ...draft,
      createdAt: new Date("2026-08-25T00:00:00.000Z"),
    }),
  );

  const form = new FormData();
  form.set("note_id", "1");
  form.set("file", file);
  const { POST } = await import("@/app/api/attachments/upload/route");
  const response = await POST(
    new NextRequest("http://localhost/api/attachments/upload", {
      method: "POST",
      body: form,
    }),
  );
  return { response, stored };
}

function capturedTelemetry(): string {
  return JSON.stringify(mocks.captureException.mock.calls);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthUser.mockResolvedValue({ user: { id: "synthetic-owner" } });
  mocks.hasValidVaultProof.mockResolvedValue(false);
  mocks.canAccessVaultedNote.mockImplementation(
    async (_request: NextRequest, _userId: string, vaulted: boolean | null) =>
      !vaulted,
  );
  mocks.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "synthetic-url" },
    error: null,
  });
  mocks.removeStorage.mockResolvedValue({ error: null });
  mocks.uploadStorage.mockResolvedValue({ error: null });
  mocks.createUploadReservation.mockResolvedValue({
    id: "reservation",
    leaseToken: "lease",
  });
  mocks.cleanupFailedUpload.mockResolvedValue(true);
});

describe("note data boundary", () => {
  it.each([
    ["JPEG", "jpeg", "ordinary.jpg", "image/jpeg"],
    ["WebP", "webp", "source.webp", "image/webp"],
    ["AVIF", "avif", "already.avif", "image/avif"],
    ["HEIC", "heic", "camera.heic", "image/heic"],
    ["HEIF", "heic", "camera.heif", "image/heif"],
  ] as const)(
    "stores a %s input as one real canonical AVIF object",
    async (_label, format, fileName, fileType) => {
      const { response, stored } = await uploadImage(
        await syntheticImageFile(format, fileName, fileType),
      );

      expect(response.status).toBe(201);
      expect(stored).toHaveLength(1);
      const [object] = stored;
      expect(object?.path).toMatch(/\.avif$/);
      expect(object?.contentType).toBe("image/avif");
      expect(object?.bytes.subarray(4, 12).toString("ascii")).toBe("ftypavif");
      await expect(sharp(object?.bytes).metadata()).resolves.toMatchObject({
        format: "heif",
        compression: "av1",
        width: 3,
        height: 2,
      });
      const body = await response.json();
      expect(body).toMatchObject({
        fileName,
        fileType: "image/avif",
        masterFormat: "avif",
        proxyFormat: "avif",
        isAnimated: false,
        width: 3,
        height: 2,
      });
      expect(body).toMatchObject({
        masterPath: object?.path,
        proxyPath: object?.path,
        fileSize: object?.bytes.length,
      });
    },
  );

  it("returns the stable conversion error before creating a reservation or object", async () => {
    mockUploadParent();
    const form = new FormData();
    form.set("note_id", "1");
    form.set(
      "file",
      new File(["not a WebP image"], "invalid.webp", { type: "image/webp" }),
    );
    const { POST } = await import("@/app/api/attachments/upload/route");

    const response = await POST(
      new NextRequest("http://localhost/api/attachments/upload", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Image conversion failed",
    });
    expect(mocks.createUploadReservation).not.toHaveBeenCalled();
    expect(mocks.uploadStorage).not.toHaveBeenCalled();
    expect(mocks.cleanupFailedUpload).not.toHaveBeenCalled();
  });

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

  it("does not list attachment metadata or URLs from a locked vaulted note", async () => {
    mocks.db.select.mockReturnValue(
      query([
        {
          id: "attachment-1",
          noteId: 1,
          storagePath: "synthetic-path",
          proxyPath: null,
          masterPath: null,
          vaulted: true,
        },
      ]),
    );

    const { GET } = await import("@/app/api/attachments/all/route");
    const response = await GET(
      new NextRequest("http://localhost/api/attachments/all"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("does not list a locked vaulted note's attachment metadata or URLs", async () => {
    mocks.db.select
      .mockReturnValueOnce(query([{ id: 1, vaulted: true }]))
      .mockReturnValueOnce(
        query([{ id: "attachment-1", storagePath: "synthetic-path" }]),
      );

    const { GET } = await import("@/app/api/attachments/note/[noteId]/route");
    const response = await GET(
      new NextRequest("http://localhost/api/attachments/note/1"),
      { params: Promise.resolve({ noteId: "1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["id", "attachment-1"],
    ["path", "synthetic-owner/1/synthetic-path"],
  ])(
    "does not download a locked vaulted attachment by %s",
    async (key, value) => {
      mocks.canAccessVaultedNote.mockResolvedValue(false);
      mocks.db.select.mockReturnValue(
        query([
          {
            id: "attachment-1",
            storagePath: "synthetic-owner/1/synthetic-path",
            masterPath: null,
            vaulted: true,
          },
        ]),
      );

      const { GET } = await import("@/app/api/attachments/download/route");
      const response = await GET(
        new NextRequest(
          `http://localhost/api/attachments/download?${key}=${value}`,
        ),
      );

      expect(response.status).toBe(403);
      expect(mocks.createSignedUrl).not.toHaveBeenCalled();
    },
  );

  it("does not upload to a soft-deleted note", async () => {
    mocks.db.select.mockReturnValue(
      query([{ id: 1, deletedAt: new Date(), autoDeleteAt: new Date() }]),
    );
    const form = new FormData();
    form.set("note_id", "1");
    form.set(
      "file",
      new File(["synthetic"], "synthetic.txt", { type: "text/plain" }),
    );

    const { POST } = await import("@/app/api/attachments/upload/route");
    const response = await POST(
      new NextRequest("http://localhost/api/attachments/upload", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.uploadStorage).not.toHaveBeenCalled();
  });

  it("does not leak upload identity when reservation creation fails", async () => {
    mockUploadParent();
    mocks.createUploadReservation.mockRejectedValue(
      new Error("PRIVATE-FILENAME.txt synthetic-owner/1/private-path"),
    );
    const { POST } = await import("@/app/api/attachments/upload/route");

    const response = await POST(
      new NextRequest("http://localhost/api/attachments/upload", {
        method: "POST",
        body: uploadForm(),
      }),
    );

    expect(response.status).toBe(503);
    expect(mocks.captureException).toHaveBeenCalled();
    expect(capturedTelemetry()).not.toMatch(
      /PRIVATE-FILENAME|synthetic-owner|private-path/,
    );
  });

  it("does not leak provider errors or upload identity when Storage fails", async () => {
    mockUploadParent();
    mocks.uploadStorage.mockResolvedValue({
      error: {
        message: "PRIVATE-FILENAME.txt synthetic-owner/1/private-path",
      },
    });
    const { POST } = await import("@/app/api/attachments/upload/route");

    const response = await POST(
      new NextRequest("http://localhost/api/attachments/upload", {
        method: "POST",
        body: uploadForm(),
      }),
    );

    expect(response.status).toBe(500);
    expect(capturedTelemetry()).not.toMatch(
      /PRIVATE-FILENAME|synthetic-owner|private-path/,
    );
  });

  it("does not leak raw finalization or cleanup exceptions", async () => {
    mockUploadParent();
    mocks.finalizeUploadReservation.mockRejectedValue(
      new Error("FINALIZE PRIVATE-FILENAME.txt synthetic-owner/1/private-path"),
    );
    mocks.cleanupFailedUpload.mockRejectedValue(
      new Error("CLEANUP PRIVATE-FILENAME.txt synthetic-owner/1/private-path"),
    );
    const { POST } = await import("@/app/api/attachments/upload/route");

    const response = await POST(
      new NextRequest("http://localhost/api/attachments/upload", {
        method: "POST",
        body: uploadForm(),
      }),
    );

    expect(response.status).toBe(500);
    expect(mocks.captureException).toHaveBeenCalled();
    expect(capturedTelemetry()).not.toMatch(
      /PRIVATE-FILENAME|synthetic-owner|private-path|FINALIZE|CLEANUP/,
    );
  });

  it("does not orphan an upload that passed validation while its note is permanently purged", async () => {
    const uploadReachedStorage = deferred();
    const releaseUpload = deferred();
    const storagePaths = new Set<string>();
    let noteExists = true;
    let attachmentCommitted = false;

    mocks.db.select.mockImplementation(
      (selection: Record<string, unknown> | undefined) => {
        if (selection && "deletedAt" in selection) {
          return query(
            noteExists ? [{ id: 1, deletedAt: null, autoDeleteAt: null }] : [],
          );
        }
        if (selection && "storageTier" in selection) {
          return query([{ storageTier: "admin" }]);
        }
        if (selection && "vaulted" in selection) {
          return query(noteExists ? [{ id: 1, vaulted: false }] : []);
        }
        // Cleanup snapshots and post-cleanup child rechecks are empty while the
        // upload is paused before its attachment insert.
        return query([]);
      },
    );
    mocks.uploadStorage.mockImplementation(async (storagePath: string) => {
      uploadReachedStorage.resolve();
      await releaseUpload.promise;
      storagePaths.add(storagePath);
      return { error: null };
    });
    mocks.removeStorage.mockImplementation(async (paths: string[]) => {
      paths.forEach((path) => storagePaths.delete(path));
      return { error: null };
    });
    mocks.finalizeUploadReservation.mockImplementation(async () => {
      if (!noteExists) {
        const { UploadReservationError } =
          await import("@/lib/attachment-upload-reservation");
        throw new UploadReservationError("note_unavailable");
      }
      attachmentCommitted = true;
      return {
        id: "concurrent-attachment",
        noteId: 1,
        fileName: "synthetic.txt",
        fileType: "text/plain",
        fileSize: 9,
        storagePath: "synthetic-path",
        createdAt: new Date(),
      };
    });
    mocks.cleanupFailedUpload.mockImplementation(
      async (_reservation, uploadDraft) => {
        const paths = [
          uploadDraft.storagePath,
          uploadDraft.masterPath,
          uploadDraft.proxyPath,
        ].filter(Boolean);
        paths.forEach((path: string) => storagePaths.delete(path));
        return true;
      },
    );
    mocks.db.delete.mockReturnValue({
      where: async () => {
        noteExists = false;
        return [];
      },
    });

    const form = new FormData();
    form.set("note_id", "1");
    form.set(
      "file",
      new File(["synthetic"], "synthetic.txt", { type: "text/plain" }),
    );

    const { POST } = await import("@/app/api/attachments/upload/route");
    const { DELETE } = await import("@/app/api/notes/[id]/permanent/route");
    const uploadPromise = POST(
      new NextRequest("http://localhost/api/attachments/upload", {
        method: "POST",
        body: form,
      }),
    );

    await uploadReachedStorage.promise;
    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/notes/1/permanent", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      }),
      { params: Promise.resolve({ id: "1" }) },
    );
    releaseUpload.resolve();
    const uploadResponse = await uploadPromise;

    const parentWasDeleted = deleteResponse.status === 200;
    expect({
      bothRoutesReportedSuccess:
        parentWasDeleted && uploadResponse.status === 201,
      orphanAttachment: parentWasDeleted && attachmentCommitted,
      orphanStoragePaths: parentWasDeleted ? [...storagePaths] : [],
    }).toEqual({
      bothRoutesReportedSuccess: false,
      orphanAttachment: false,
      orphanStoragePaths: [],
    });
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

  it("does not delete a parent note when an attachment arrives during cleanup", async () => {
    mocks.db.select
      .mockReturnValueOnce(query([{ id: 1, vaulted: false }]))
      .mockReturnValueOnce(
        query([
          {
            id: "snapshotted",
            storagePath: "synthetic-path",
            proxyPath: null,
            masterPath: null,
          },
        ]),
      )
      .mockReturnValueOnce(query([{ id: "concurrent-upload" }]));
    mocks.db.delete.mockReturnValue({ where: () => Promise.resolve([]) });

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
    expect(mocks.db.delete).toHaveBeenCalledTimes(2);
  });

  it.each(["GET", "PATCH", "DELETE"] as const)(
    "does not expose a vaulted version item through %s",
    async (method) => {
      mocks.db.select.mockReturnValue(query([{ id: 1, vaulted: true }]));
      const handlers =
        await import("@/app/api/notes/[id]/versions/[versionId]/route");
      const request = new NextRequest(
        "http://localhost/api/notes/1/versions/1",
        {
          method,
          headers:
            method === "PATCH"
              ? { "content-type": "application/json" }
              : undefined,
          body:
            method === "PATCH"
              ? JSON.stringify({ label: "synthetic" })
              : undefined,
        },
      );
      const response = await handlers[method](request, {
        params: Promise.resolve({ id: "1", versionId: "1" }),
      });

      expect(response.status).toBe(403);
    },
  );

  it("does not restore a vaulted version without its owner's valid proof", async () => {
    mocks.db.select.mockReturnValue(query([{ id: 1, vaulted: true }]));
    const { POST } =
      await import("@/app/api/notes/[id]/versions/[versionId]/restore/route");
    const response = await POST(
      new NextRequest("http://localhost/api/notes/1/versions/1/restore", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "1", versionId: "1" }) },
    );

    expect(response.status).toBe(403);
  });
});
