import { type NextRequest, NextResponse } from "next/server";
import { eq, and, sum, isNull } from "drizzle-orm";
import { db, attachmentsTable, notesTable, usersTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ALLOWED_MIME_TYPES,
  HEIC_MIME_TYPES,
  IMAGE_MIME_TYPES,
  TIER_LIMITS,
  type StorageTier,
  formatBytes,
  ANIMATED_GIF_MAX_BYTES,
  ANIMATED_GIF_MAX_FRAMES,
} from "@/lib/attachment-limits";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import {
  cleanupFailedUpload,
  createUploadReservation,
  finalizeUploadReservation,
  UploadReservationError,
} from "@/lib/attachment-upload-reservation";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/** Returns true if the buffer's magic bytes match HEIC/HEIF. */
function hasHeicMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ftyp = buf.toString("ascii", 4, 8);
  if (ftyp !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return [
    "heic",
    "heis",
    "hevx",
    "heim",
    "heix",
    "hevc",
    "hevs",
    "mif1",
    "msf1",
  ].includes(brand);
}

function isHeicInput(mimeType: string, filename: string, buf: Buffer): boolean {
  if (HEIC_MIME_TYPES.has(mimeType)) return true;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "heic" || ext === "heif") return true;
  return hasHeicMagicBytes(buf);
}

/**
 * Validate that the file's magic bytes match its declared image content-type,
 * blocking content-type spoofing (§S) — e.g. an HTML/SVG payload uploaded as
 * image/png. Only the raster types we can cheaply fingerprint are enforced here;
 * other allowed image types (webp/avif/gif/heic) are validated downstream by
 * sharp/heic-convert, which reject non-images.
 */
function imageMagicMatches(mimeType: string, buf: Buffer): boolean {
  if (mimeType === "image/jpeg") {
    return (
      buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return buf.length >= 8 && sig.every((b, i) => buf[i] === b);
  }
  return true;
}

type MasterFormat = "jpg" | "png" | "gif" | "avif";

/**
 * Produce the master buffer for non-GIF images.
 *
 * JPEG / PNG → byte-identical (no re-encoding).
 * HEIC / HEIF → q=95 JPEG via sharp; heic-convert fallback if libheif missing.
 * WebP / other → q=95 JPEG via sharp.
 * AVIF → try q=95 JPEG via sharp; if the AVIF codec isn't available on this
 *         runtime (e.g. macOS dev with limited libheif), fall back to storing
 *         the original AVIF byte-identical (it's already browser-renderable).
 */
async function toMaster(
  buf: Buffer,
  mimeType: string,
  isHeic: boolean,
): Promise<{
  masterBuffer: Buffer;
  masterFormat: Exclude<MasterFormat, "gif">;
}> {
  if (mimeType === "image/jpeg")
    return { masterBuffer: buf, masterFormat: "jpg" };
  if (mimeType === "image/png")
    return { masterBuffer: buf, masterFormat: "png" };

  const sharp = (await import("sharp")).default;

  if (isHeic) {
    try {
      const masterBuffer = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
      return { masterBuffer, masterFormat: "jpg" };
    } catch {
      // libheif not available on this runtime — fall back to heic-convert
      const heicConvert = (await import("heic-convert")).default;
      const jpegBuf = Buffer.from(
        await heicConvert({ buffer: buf, format: "JPEG", quality: 0.95 }),
      );
      return { masterBuffer: jpegBuf, masterFormat: "jpg" };
    }
  }

  // AVIF: try JPEG conversion; fall back to storing as-is if codec unavailable
  if (mimeType === "image/avif") {
    try {
      const masterBuffer = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
      return { masterBuffer, masterFormat: "jpg" };
    } catch {
      // AVIF decode not supported on this runtime — store byte-identical.
      // The original AVIF is already compressed and browser-renderable; it
      // will serve as both master (download) and proxy (display).
      return { masterBuffer: buf, masterFormat: "avif" };
    }
  }

  // WebP or other — convert to JPEG master
  const masterBuffer = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
  return { masterBuffer, masterFormat: "jpg" };
}

/**
 * Detect if a GIF buffer is animated (more than 1 frame).
 * Uses sharp metadata `pages` field which counts GIF frames.
 */
async function detectAnimatedGif(
  mimeType: string,
  buf: Buffer,
): Promise<{ isAnimated: boolean; frameCount: number }> {
  if (mimeType !== "image/gif") return { isAnimated: false, frameCount: 1 };
  try {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(buf, { animated: true }).metadata();
    const frameCount = metadata.pages ?? 1;
    return { isAnimated: frameCount > 1, frameCount };
  } catch {
    return { isAnimated: false, frameCount: 1 };
  }
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const noteIdRaw = formData.get("note_id");

  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!noteIdRaw)
    return NextResponse.json({ error: "note_id is required" }, { status: 400 });

  const noteId = Number(noteIdRaw);
  if (!Number.isInteger(noteId) || noteId <= 0) {
    return NextResponse.json({ error: "Invalid note_id" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "This file type isn't supported." },
      { status: 422 },
    );
  }

  try {
    const [note] = await db
      .select({
        id: notesTable.id,
        deletedAt: notesTable.deletedAt,
        autoDeleteAt: notesTable.autoDeleteAt,
      })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note)
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    if (note.deletedAt || note.autoDeleteAt) {
      return NextResponse.json(
        { error: "Note is unavailable for attachments" },
        { status: 409 },
      );
    }

    const [userRow] = await db
      .select({ storageTier: usersTable.storageTier })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const tier = (userRow?.storageTier ?? "free") as StorageTier;
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    // Size check against original upload size (pre-conversion)
    if (limits.maxFileSize !== Infinity && file.size > limits.maxFileSize) {
      return NextResponse.json(
        { error: `File exceeds the ${formatBytes(limits.maxFileSize)} limit` },
        { status: 422 },
      );
    }

    if (limits.maxTotalStorage !== null) {
      const [usageRow] = await db
        .select({ total: sum(attachmentsTable.fileSize) })
        .from(attachmentsTable)
        // X-A3: only live bytes count toward the quota — soft-deleted (and
        // pending-purge) attachments must not permanently shrink the cap.
        .where(
          and(
            eq(attachmentsTable.userId, user.id),
            isNull(attachmentsTable.deletedAt),
          ),
        );
      const currentUsage = Number(usageRow?.total ?? 0);
      if (currentUsage + file.size > limits.maxTotalStorage) {
        const used = formatBytes(currentUsage);
        const max = formatBytes(limits.maxTotalStorage);
        return NextResponse.json(
          { error: `You've used ${used} of your ${max} storage` },
          { status: 422 },
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const uploadBuffer = Buffer.from(arrayBuffer);

    // Reject files whose bytes don't match their declared image type (§S).
    if (!imageMagicMatches(mimeType, uploadBuffer)) {
      return NextResponse.json(
        { error: "This file's contents don't match its type." },
        { status: 422 },
      );
    }

    // Non-image files: single-file upload, no master/proxy split
    if (!IMAGE_MIME_TYPES.has(mimeType)) {
      const sanitized = sanitizeFilename(file.name);
      const fileId = randomUUID();
      const storagePath = `${user.id}/${noteId}/${fileId}-${sanitized}`;
      const draft = {
        noteId,
        userId: user.id,
        fileName: file.name,
        fileType: mimeType,
        fileSize: uploadBuffer.length,
        storagePath,
      };
      let reservation;
      try {
        reservation = await createUploadReservation(draft);
      } catch {
        return NextResponse.json(
          { error: "Upload temporarily unavailable" },
          { status: 503 },
        );
      }

      const { error: uploadError } = await supabaseAdmin.storage
        .from("note-attachments")
        .upload(storagePath, uploadBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        Sentry.captureException(
          new Error(
            `[attachments] Storage upload error: ${uploadError.message}`,
          ),
        );
        await cleanupFailedUpload(reservation, draft, "storage_upload_failed");
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
      }

      let attachment;
      try {
        attachment = await finalizeUploadReservation(reservation, draft);
      } catch (insertError) {
        await cleanupFailedUpload(
          reservation,
          draft,
          insertError instanceof UploadReservationError
            ? insertError.code
            : "finalize_failed",
        );
        if (
          insertError instanceof UploadReservationError &&
          insertError.code === "note_unavailable"
        ) {
          return NextResponse.json(
            { error: "Note is unavailable for attachments" },
            { status: 409 },
          );
        }
        if (insertError instanceof UploadReservationError) {
          return NextResponse.json(
            { error: "Upload temporarily unavailable" },
            { status: 503 },
          );
        }
        throw insertError;
      }

      const { data: signedData } = await supabaseAdmin.storage
        .from("note-attachments")
        .createSignedUrl(storagePath, 604800);

      return NextResponse.json(
        {
          id: attachment.id,
          noteId: attachment.noteId,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          storagePath: attachment.storagePath,
          createdAt: attachment.createdAt,
          url: signedData?.signedUrl ?? null,
        },
        { status: 201 },
      );
    }

    // ── Animated GIF path ────────────────────────────────────────────────────
    if (mimeType === "image/gif") {
      const { isAnimated, frameCount } = await detectAnimatedGif(
        mimeType,
        uploadBuffer,
      );

      if (isAnimated) {
        // Pre-encode caps (protect server memory / timeout budget)
        if (uploadBuffer.length > ANIMATED_GIF_MAX_BYTES) {
          return NextResponse.json(
            {
              error: `Animated GIFs must be under ${formatBytes(ANIMATED_GIF_MAX_BYTES)}`,
            },
            { status: 422 },
          );
        }
        if (frameCount > ANIMATED_GIF_MAX_FRAMES) {
          return NextResponse.json(
            {
              error: `Animated GIFs must have fewer than ${ANIMATED_GIF_MAX_FRAMES} frames`,
            },
            { status: 422 },
          );
        }

        // Master = original GIF (byte-identical, preserves all frames + timing)
        const masterBuffer = uploadBuffer;
        const masterFormat: MasterFormat = "gif";
        const fileId = randomUUID();
        const baseName = sanitizeFilename(file.name).replace(/\.[^.]+$/, "");
        const masterPath = `${user.id}/${noteId}/${fileId}/${baseName}.gif`;
        const proxyPath = `${user.id}/${noteId}/${fileId}/${baseName}.webp`;

        // Proxy = animated WebP. Encodes in <1s vs 5–15s for AVIF, no timeout needed.
        // Quality difference between WebP and AVIF is imperceptible at note-app scale;
        // the reliability and speed win is decisive.
        const sharp = (await import("sharp")).default;
        let proxyBuffer: Buffer;
        let width: number | undefined;
        let height: number | undefined;
        try {
          const sharpGif = sharp(masterBuffer, { animated: true });
          const [proxyBuf, meta] = await Promise.all([
            sharpGif.clone().webp({ quality: 85 }).toBuffer(),
            sharpGif.clone().metadata(),
          ]);
          proxyBuffer = proxyBuf;
          width = meta.width;
          height = meta.pageHeight ?? meta.height; // pageHeight = single frame height
        } catch (convErr) {
          Sentry.captureException(convErr, {
            extra: { originalMimeType: mimeType },
          });
          return NextResponse.json(
            { error: "Image conversion failed" },
            { status: 422 },
          );
        }

        const masterSizeBytes = masterBuffer.length;
        const proxySizeBytes = proxyBuffer.length;
        const draft = {
          noteId,
          userId: user.id,
          fileName: file.name,
          fileType: "image/gif",
          fileSize: masterSizeBytes + proxySizeBytes,
          storagePath: null,
          masterPath,
          proxyPath,
          masterFormat,
          proxyFormat: "webp",
          isAnimated: true,
          masterSizeBytes,
          proxySizeBytes,
          width: width ?? null,
          height: height ?? null,
        };
        let reservation;
        try {
          reservation = await createUploadReservation(draft);
        } catch {
          return NextResponse.json(
            { error: "Upload temporarily unavailable" },
            { status: 503 },
          );
        }

        // Upload master and proxy in parallel
        const [masterUpload, proxyUpload] = await Promise.all([
          supabaseAdmin.storage
            .from("note-attachments")
            .upload(masterPath, masterBuffer, {
              contentType: "image/gif",
              upsert: false,
            }),
          supabaseAdmin.storage
            .from("note-attachments")
            .upload(proxyPath, proxyBuffer, {
              contentType: "image/webp",
              upsert: false,
            }),
        ]);

        if (masterUpload.error || proxyUpload.error) {
          const err = masterUpload.error ?? proxyUpload.error;
          Sentry.captureException(
            new Error(`[attachments] GIF upload error: ${err!.message}`),
          );
          await cleanupFailedUpload(
            reservation,
            draft,
            "storage_upload_failed",
          );
          return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        let attachment;
        try {
          attachment = await finalizeUploadReservation(reservation, draft);
        } catch (insertError) {
          await cleanupFailedUpload(
            reservation,
            draft,
            insertError instanceof UploadReservationError
              ? insertError.code
              : "finalize_failed",
          );
          if (insertError instanceof UploadReservationError) {
            return NextResponse.json(
              {
                error:
                  insertError.code === "note_unavailable"
                    ? "Note is unavailable for attachments"
                    : "Upload temporarily unavailable",
              },
              { status: insertError.code === "note_unavailable" ? 409 : 503 },
            );
          }
          throw insertError;
        }

        const [proxySign, masterSign] = await Promise.all([
          supabaseAdmin.storage
            .from("note-attachments")
            .createSignedUrl(proxyPath, 604800),
          supabaseAdmin.storage
            .from("note-attachments")
            .createSignedUrl(masterPath, 604800),
        ]);

        return NextResponse.json(
          {
            id: attachment.id,
            noteId: attachment.noteId,
            fileName: attachment.fileName,
            fileType: attachment.fileType,
            fileSize: attachment.fileSize,
            storagePath: null,
            masterPath: attachment.masterPath,
            proxyPath: attachment.proxyPath,
            masterFormat: attachment.masterFormat,
            proxyFormat: attachment.proxyFormat,
            isAnimated: attachment.isAnimated,
            width: attachment.width,
            height: attachment.height,
            createdAt: attachment.createdAt,
            url: proxySign.data?.signedUrl ?? null,
            masterUrl: masterSign.data?.signedUrl ?? null,
          },
          { status: 201 },
        );
      }
      // Static GIF falls through to normal JPEG-master path below
    }

    // ── Standard image path (JPEG, PNG, HEIC, WebP, AVIF, static GIF) ───────
    const heic = isHeicInput(mimeType, file.name, uploadBuffer);

    let masterBuffer: Buffer;
    let masterFormat: Exclude<MasterFormat, "gif">;
    try {
      ({ masterBuffer, masterFormat } = await toMaster(
        uploadBuffer,
        mimeType,
        heic,
      ));
    } catch (convErr) {
      Sentry.captureException(convErr, {
        extra: { originalMimeType: mimeType },
      });
      return NextResponse.json(
        { error: "Image conversion failed" },
        { status: 422 },
      );
    }

    const sharp = (await import("sharp")).default;
    const fileId = randomUUID();
    const baseName = sanitizeFilename(file.name).replace(/\.[^.]+$/, ""); // strip extension, keep original name

    let proxyBuffer: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    let proxyPath: string;
    let proxyFormat: string;
    let sameFileForProxy = false;

    if (masterFormat === "avif") {
      // Input was AVIF and could not be transcoded — reuse master as proxy.
      // AVIF is already browser-renderable and well-compressed; no re-encoding needed.
      proxyBuffer = masterBuffer;
      proxyPath = `${user.id}/${noteId}/${fileId}/${baseName}.avif`; // same name, set below as masterPath
      proxyFormat = "avif";
      sameFileForProxy = true;
      try {
        const meta = await sharp(masterBuffer).metadata();
        width = meta.width;
        height = meta.height;
      } catch {
        /* non-critical */
      }
    } else {
      // Generate WebP proxy from JPEG/PNG master.
      // WebP is chosen over AVIF for static images: encoding is ~10x faster (no
      // perceptible wait), codec support is rock-solid across all Sharp builds, and
      // quality 85 is visually indistinguishable from the original at 25–35% smaller
      // than JPEG. AVIF is reserved for animated GIFs where its compression advantage
      // over animated WebP is substantial and the async encoding cost is acceptable.
      try {
        const sharpMaster = sharp(masterBuffer);
        const [proxyBuf, metadata] = await Promise.all([
          sharpMaster.clone().webp({ quality: 85 }).toBuffer(),
          sharpMaster.clone().metadata(),
        ]);
        proxyBuffer = proxyBuf;
        width = metadata.width;
        height = metadata.height;
      } catch (convErr) {
        Sentry.captureException(convErr, {
          extra: { originalMimeType: mimeType },
        });
        return NextResponse.json(
          { error: "Image conversion failed" },
          { status: 422 },
        );
      }
      proxyPath = `${user.id}/${noteId}/${fileId}/${baseName}.webp`;
      proxyFormat = "webp";
    }

    const masterPath = `${user.id}/${noteId}/${fileId}/${baseName}.${masterFormat}`;
    // When AVIF is stored as-is, master and proxy share the same path
    const resolvedProxyPath = sameFileForProxy ? masterPath : proxyPath;

    const masterMime =
      masterFormat === "png"
        ? "image/png"
        : masterFormat === "avif"
          ? "image/avif"
          : "image/jpeg";
    const masterSizeBytes = masterBuffer.length;
    const proxySizeBytes = sameFileForProxy ? 0 : proxyBuffer.length;
    const draft = {
      noteId,
      userId: user.id,
      fileName: file.name,
      fileType: masterMime,
      fileSize: masterSizeBytes + proxySizeBytes,
      storagePath: null,
      masterPath,
      proxyPath: resolvedProxyPath,
      masterFormat,
      proxyFormat,
      isAnimated: false,
      masterSizeBytes,
      proxySizeBytes,
      width: width ?? null,
      height: height ?? null,
    };
    let reservation;
    try {
      reservation = await createUploadReservation(draft);
    } catch {
      return NextResponse.json(
        { error: "Upload temporarily unavailable" },
        { status: 503 },
      );
    }

    // Upload master (and proxy if it's a separate file)
    const uploadTasks: Promise<{
      error: { message: string } | null;
      which: string;
    }>[] = [
      supabaseAdmin.storage
        .from("note-attachments")
        .upload(masterPath, masterBuffer, {
          contentType: masterMime,
          upsert: false,
        })
        .then((r) => ({ error: r.error, which: "master" })),
    ];
    if (!sameFileForProxy) {
      uploadTasks.push(
        supabaseAdmin.storage
          .from("note-attachments")
          .upload(resolvedProxyPath, proxyBuffer, {
            contentType: `image/${proxyFormat}`,
            upsert: false,
          })
          .then((r) => ({ error: r.error, which: "proxy" })),
      );
    }

    const uploadResults = await Promise.all(uploadTasks);
    const failedUpload = uploadResults.find((r) => r.error);
    if (failedUpload) {
      const err = failedUpload.error!;
      Sentry.captureException(
        new Error(
          `[attachments] Storage upload error (${failedUpload.which}): ${err.message}`,
        ),
      );
      await cleanupFailedUpload(reservation, draft, "storage_upload_failed");
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    let attachment;
    try {
      attachment = await finalizeUploadReservation(reservation, draft);
    } catch (insertError) {
      await cleanupFailedUpload(
        reservation,
        draft,
        insertError instanceof UploadReservationError
          ? insertError.code
          : "finalize_failed",
      );
      if (insertError instanceof UploadReservationError) {
        return NextResponse.json(
          {
            error:
              insertError.code === "note_unavailable"
                ? "Note is unavailable for attachments"
                : "Upload temporarily unavailable",
          },
          { status: insertError.code === "note_unavailable" ? 409 : 503 },
        );
      }
      throw insertError;
    }

    // Generate signed URLs (1 hr) for proxy (display) and master (download)
    const [proxySign, masterSign] = await Promise.all([
      supabaseAdmin.storage
        .from("note-attachments")
        .createSignedUrl(resolvedProxyPath, 604800),
      supabaseAdmin.storage
        .from("note-attachments")
        .createSignedUrl(masterPath, 604800),
    ]);

    return NextResponse.json(
      {
        id: attachment.id,
        noteId: attachment.noteId,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        storagePath: null,
        masterPath: attachment.masterPath,
        proxyPath: attachment.proxyPath,
        masterFormat: attachment.masterFormat,
        proxyFormat: attachment.proxyFormat,
        isAnimated: attachment.isAnimated,
        width: attachment.width,
        height: attachment.height,
        createdAt: attachment.createdAt,
        url: proxySign.data?.signedUrl ?? null, // proxy — for display
        masterUrl: masterSign.data?.signedUrl ?? null, // master — for download
      },
      { status: 201 },
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
