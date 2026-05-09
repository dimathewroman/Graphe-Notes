import { type NextRequest, NextResponse } from "next/server";
import { eq, and, sum } from "drizzle-orm";
import { db, attachmentsTable, notesTable, usersTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ALLOWED_MIME_TYPES, HEIC_MIME_TYPES, IMAGE_MIME_TYPES,
  TIER_LIMITS, type StorageTier, formatBytes,
  ANIMATED_GIF_MAX_BYTES, ANIMATED_GIF_MAX_FRAMES,
} from "@/lib/attachment-limits";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/** Returns true if the buffer's magic bytes match HEIC/HEIF. */
function hasHeicMagicBytes(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  const ftyp = buf.toString("ascii", 4, 8);
  if (ftyp !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return ["heic", "heis", "hevx", "heim", "heix", "hevc", "hevs", "mif1", "msf1"].includes(brand);
}

function isHeicInput(mimeType: string, filename: string, buf: Buffer): boolean {
  if (HEIC_MIME_TYPES.has(mimeType)) return true;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "heic" || ext === "heif") return true;
  return hasHeicMagicBytes(buf);
}

type MasterFormat = "jpg" | "png" | "gif";

/**
 * Produce the master buffer for non-GIF images.
 *
 * JPEG / PNG → byte-identical (no re-encoding).
 * HEIC / HEIF / WebP / AVIF → q=95 JPEG via sharp.
 *   If sharp lacks libheif, fall back to heic-convert for HEIC/HEIF inputs.
 */
async function toMaster(
  buf: Buffer,
  mimeType: string,
  isHeic: boolean,
): Promise<{ masterBuffer: Buffer; masterFormat: Exclude<MasterFormat, "gif"> }> {
  if (mimeType === "image/jpeg") return { masterBuffer: buf, masterFormat: "jpg" };
  if (mimeType === "image/png") return { masterBuffer: buf, masterFormat: "png" };

  const sharp = (await import("sharp")).default;

  if (isHeic) {
    try {
      const masterBuffer = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
      return { masterBuffer, masterFormat: "jpg" };
    } catch {
      // libheif not available on this runtime — fall back to heic-convert
      const heicConvert = (await import("heic-convert")).default;
      const jpegBuf = Buffer.from(
        await heicConvert({ buffer: buf, format: "JPEG", quality: 0.95 })
      );
      return { masterBuffer: jpegBuf, masterFormat: "jpg" };
    }
  }

  // WebP, AVIF, or other — convert to JPEG master
  const masterBuffer = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
  return { masterBuffer, masterFormat: "jpg" };
}

/**
 * Detect if a GIF buffer is animated (more than 1 frame).
 * Uses sharp metadata `pages` field which counts GIF frames.
 */
async function detectAnimatedGif(mimeType: string, buf: Buffer): Promise<{ isAnimated: boolean; frameCount: number }> {
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

/**
 * Generate an animated AVIF proxy from a GIF buffer.
 * Enforces a 12-second timeout — if it fires, the caller uses the original GIF as proxy.
 */
async function toAnimatedAvifProxy(gifBuf: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    const encode = sharp(gifBuf, { animated: true }).avif({ quality: 80, effort: 4 });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000));
    const encodePromise = encode.toBuffer().then(buf => buf);

    return await Promise.race([encodePromise, timeoutPromise]);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const noteIdRaw = formData.get("note_id");

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!noteIdRaw) return NextResponse.json({ error: "note_id is required" }, { status: 400 });

  const noteId = Number(noteIdRaw);
  if (!Number.isInteger(noteId) || noteId <= 0) {
    return NextResponse.json({ error: "Invalid note_id" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "This file type isn't supported." }, { status: 422 });
  }

  try {
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const [userRow] = await db
      .select({ storageTier: usersTable.storageTier })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const tier = ((userRow?.storageTier ?? "free") as StorageTier);
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    // Size check against original upload size (pre-conversion)
    if (limits.maxFileSize !== Infinity && file.size > limits.maxFileSize) {
      return NextResponse.json(
        { error: `File exceeds the ${formatBytes(limits.maxFileSize)} limit` },
        { status: 422 }
      );
    }

    if (limits.maxTotalStorage !== null) {
      const [usageRow] = await db
        .select({ total: sum(attachmentsTable.fileSize) })
        .from(attachmentsTable)
        .where(eq(attachmentsTable.userId, user.id));
      const currentUsage = Number(usageRow?.total ?? 0);
      if (currentUsage + file.size > limits.maxTotalStorage) {
        const used = formatBytes(currentUsage);
        const max = formatBytes(limits.maxTotalStorage);
        return NextResponse.json(
          { error: `You've used ${used} of your ${max} storage` },
          { status: 422 }
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const uploadBuffer = Buffer.from(arrayBuffer);

    // Non-image files: single-file upload, no master/proxy split
    if (!IMAGE_MIME_TYPES.has(mimeType)) {
      const sanitized = sanitizeFilename(file.name);
      const fileId = randomUUID();
      const storagePath = `${user.id}/${noteId}/${fileId}-${sanitized}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("note-attachments")
        .upload(storagePath, uploadBuffer, { contentType: mimeType, upsert: false });

      if (uploadError) {
        Sentry.captureException(new Error(`[attachments] Storage upload error: ${uploadError.message}`));
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
      }

      const [attachment] = await db
        .insert(attachmentsTable)
        .values({
          noteId,
          userId: user.id,
          fileName: file.name,
          fileType: mimeType,
          fileSize: uploadBuffer.length,
          storagePath,
        })
        .returning();

      const { data: signedData } = await supabaseAdmin.storage
        .from("note-attachments")
        .createSignedUrl(storagePath, 3600);

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
        { status: 201 }
      );
    }

    // ── Animated GIF path ────────────────────────────────────────────────────
    if (mimeType === "image/gif") {
      const { isAnimated, frameCount } = await detectAnimatedGif(mimeType, uploadBuffer);

      if (isAnimated) {
        // Pre-encode caps (protect server memory / timeout budget)
        if (uploadBuffer.length > ANIMATED_GIF_MAX_BYTES) {
          return NextResponse.json(
            { error: `Animated GIFs must be under ${formatBytes(ANIMATED_GIF_MAX_BYTES)}` },
            { status: 422 }
          );
        }
        if (frameCount > ANIMATED_GIF_MAX_FRAMES) {
          return NextResponse.json(
            { error: `Animated GIFs must have fewer than ${ANIMATED_GIF_MAX_FRAMES} frames` },
            { status: 422 }
          );
        }

        // Master = original GIF (byte-identical, preserves all frames)
        const masterBuffer = uploadBuffer;
        const masterFormat: MasterFormat = "gif";
        const fileId = randomUUID();
        const masterPath = `${user.id}/${noteId}/${fileId}/master.gif`;

        // Proxy = animated AVIF (12s timeout) or GIF fallback
        const avifBuf = await toAnimatedAvifProxy(masterBuffer);
        const proxyIsAvif = avifBuf !== null;
        const proxyBuffer = avifBuf ?? masterBuffer;
        const proxyFormat = proxyIsAvif ? "avif" : "gif";
        const proxyPath = proxyIsAvif
          ? `${user.id}/${noteId}/${fileId}/proxy.avif`
          : masterPath; // point to master — no separate upload needed

        // Dimensions from first frame
        const sharp = (await import("sharp")).default;
        let width: number | undefined;
        let height: number | undefined;
        try {
          const meta = await sharp(masterBuffer, { animated: true }).metadata();
          width = meta.width;
          // pageHeight is the height of a single frame in an animated image
          height = meta.pageHeight ?? meta.height;
        } catch { /* non-critical */ }

        // Upload master; upload proxy only if it differs from master
        const uploads: Promise<{ error: { message: string } | null }>[] = [
          supabaseAdmin.storage
            .from("note-attachments")
            .upload(masterPath, masterBuffer, { contentType: "image/gif", upsert: false })
            .then(r => ({ error: r.error })),
        ];
        if (proxyIsAvif) {
          uploads.push(
            supabaseAdmin.storage
              .from("note-attachments")
              .upload(proxyPath, proxyBuffer, { contentType: "image/avif", upsert: false })
              .then(r => ({ error: r.error }))
          );
        }

        const results = await Promise.all(uploads);
        const failedUpload = results.find(r => r.error);
        if (failedUpload) {
          Sentry.captureException(new Error(`[attachments] GIF upload error: ${failedUpload.error!.message}`));
          // Best-effort cleanup
          const toRemove = [masterPath];
          if (proxyIsAvif) toRemove.push(proxyPath);
          await supabaseAdmin.storage.from("note-attachments").remove(toRemove);
          return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        const masterSizeBytes = masterBuffer.length;
        const proxySizeBytes = proxyIsAvif ? proxyBuffer.length : 0; // not double-counting

        const [attachment] = await db
          .insert(attachmentsTable)
          .values({
            noteId,
            userId: user.id,
            fileName: file.name,
            fileType: "image/gif",
            fileSize: masterSizeBytes + proxySizeBytes,
            storagePath: null,
            masterPath,
            proxyPath,
            masterFormat,
            proxyFormat,
            isAnimated: true,
            masterSizeBytes,
            proxySizeBytes: proxyIsAvif ? proxyBuffer.length : 0,
            width: width ?? null,
            height: height ?? null,
          })
          .returning();

        // Signed URLs: proxy for display, master for download
        const signUrls = [
          supabaseAdmin.storage.from("note-attachments").createSignedUrl(proxyPath, 3600),
          supabaseAdmin.storage.from("note-attachments").createSignedUrl(masterPath, 3600),
        ];
        const [proxySign, masterSign] = await Promise.all(signUrls);

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
          { status: 201 }
        );
      }
      // Static GIF falls through to normal JPEG-master path below
    }

    // ── Standard image path (JPEG, PNG, HEIC, WebP, AVIF, static GIF) ───────
    const heic = isHeicInput(mimeType, file.name, uploadBuffer);

    let masterBuffer: Buffer;
    let masterFormat: Exclude<MasterFormat, "gif">;
    try {
      ({ masterBuffer, masterFormat } = await toMaster(uploadBuffer, mimeType, heic));
    } catch (convErr) {
      Sentry.captureException(convErr, { extra: { originalMimeType: mimeType } });
      return NextResponse.json({ error: "Image conversion failed" }, { status: 422 });
    }

    // Generate AVIF proxy
    const sharp = (await import("sharp")).default;
    let proxyBuffer: Buffer;
    let width: number | undefined;
    let height: number | undefined;
    try {
      const sharpMaster = sharp(masterBuffer);
      const [proxyBuf, metadata] = await Promise.all([
        sharpMaster.clone().avif({ quality: 80 }).toBuffer(),
        sharpMaster.clone().metadata(),
      ]);
      proxyBuffer = proxyBuf;
      width = metadata.width;
      height = metadata.height;
    } catch (convErr) {
      Sentry.captureException(convErr, { extra: { originalMimeType: mimeType } });
      return NextResponse.json({ error: "Image conversion failed" }, { status: 422 });
    }

    const fileId = randomUUID();
    const masterPath = `${user.id}/${noteId}/${fileId}/master.${masterFormat}`;
    const proxyPath = `${user.id}/${noteId}/${fileId}/proxy.avif`;

    const masterMime = masterFormat === "png" ? "image/png" : "image/jpeg";

    // Upload master and proxy in parallel
    const [masterUpload, proxyUpload] = await Promise.all([
      supabaseAdmin.storage
        .from("note-attachments")
        .upload(masterPath, masterBuffer, { contentType: masterMime, upsert: false }),
      supabaseAdmin.storage
        .from("note-attachments")
        .upload(proxyPath, proxyBuffer, { contentType: "image/avif", upsert: false }),
    ]);

    if (masterUpload.error || proxyUpload.error) {
      const err = masterUpload.error ?? proxyUpload.error;
      Sentry.captureException(new Error(`[attachments] Storage upload error: ${err!.message}`));
      // Best-effort cleanup of whichever file succeeded
      if (!masterUpload.error) await supabaseAdmin.storage.from("note-attachments").remove([masterPath]);
      if (!proxyUpload.error) await supabaseAdmin.storage.from("note-attachments").remove([proxyPath]);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const masterSizeBytes = masterBuffer.length;
    const proxySizeBytes = proxyBuffer.length;

    const [attachment] = await db
      .insert(attachmentsTable)
      .values({
        noteId,
        userId: user.id,
        fileName: file.name,
        fileType: masterMime,
        fileSize: masterSizeBytes + proxySizeBytes,
        storagePath: null,
        masterPath,
        proxyPath,
        masterFormat,
        proxyFormat: "avif",
        isAnimated: false,
        masterSizeBytes,
        proxySizeBytes,
        width: width ?? null,
        height: height ?? null,
      })
      .returning();

    // Generate signed URLs (1 hr) for proxy (display) and master (download)
    const [proxySign, masterSign] = await Promise.all([
      supabaseAdmin.storage.from("note-attachments").createSignedUrl(proxyPath, 3600),
      supabaseAdmin.storage.from("note-attachments").createSignedUrl(masterPath, 3600),
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
        url: proxySign.data?.signedUrl ?? null,       // proxy — for display
        masterUrl: masterSign.data?.signedUrl ?? null, // master — for download
      },
      { status: 201 }
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
