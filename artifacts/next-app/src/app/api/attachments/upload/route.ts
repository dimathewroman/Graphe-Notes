import { type NextRequest, NextResponse } from "next/server";
import { eq, and, sum } from "drizzle-orm";
import { db, attachmentsTable, notesTable, usersTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ALLOWED_MIME_TYPES, HEIC_MIME_TYPES, IMAGE_MIME_TYPES, TIER_LIMITS, type StorageTier, formatBytes } from "@/lib/attachment-limits";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

/** Returns true if the buffer's magic bytes match HEIC/HEIF. */
function hasHeicMagicBytes(buf: Buffer): boolean {
  // HEIC/HEIF: bytes 4–7 are "ftyp"; brand at 8–11 is heic/heis/hevx/mif1/msf1 etc.
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

/**
 * Convert any image buffer to AVIF.
 * Primary path: sharp's native HEIC support (requires libheif on Vercel).
 * Fallback: heic-convert → JPEG → sharp → AVIF (for environments without libheif).
 */
async function toAvif(buf: Buffer, isHeic: boolean): Promise<Buffer> {
  const sharp = (await import("sharp")).default;

  if (isHeic) {
    try {
      return await sharp(buf).avif({ quality: 80 }).toBuffer();
    } catch (err) {
      // libheif not available — fall back to heic-convert
      const heicConvert = (await import("heic-convert")).default;
      const jpegBuf = Buffer.from(
        await heicConvert({ buffer: buf, format: "JPEG", quality: 0.9 })
      );
      return sharp(jpegBuf).avif({ quality: 80 }).toBuffer();
    }
  }

  return sharp(buf).avif({ quality: 80 }).toBuffer();
}

/** Strip extension from sanitized filename and append .avif */
function avifFilename(sanitized: string): string {
  const dot = sanitized.lastIndexOf(".");
  const base = dot !== -1 ? sanitized.slice(0, dot) : sanitized;
  return `${base}.avif`;
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

  // MIME type validation (before DB queries — fast reject)
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "This file type isn't supported." }, { status: 422 });
  }

  try {
    // Verify note belongs to user
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    // Get user's storage tier
    const [userRow] = await db
      .select({ storageTier: usersTable.storageTier })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const tier = ((userRow?.storageTier ?? "free") as StorageTier);
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    // Per-file size check against original upload size
    if (limits.maxFileSize !== Infinity && file.size > limits.maxFileSize) {
      return NextResponse.json(
        { error: `File exceeds the ${formatBytes(limits.maxFileSize)} limit` },
        { status: 422 }
      );
    }

    // Total storage check against original upload size
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
    // Declare as Buffer<ArrayBufferLike> so the AVIF result (also ArrayBufferLike) is assignable back
    let uploadBuffer: Buffer<ArrayBufferLike> = Buffer.from(arrayBuffer);
    let uploadMimeType = mimeType;
    let uploadFilename = sanitizeFilename(file.name);

    // Convert images to AVIF for canonical storage
    if (IMAGE_MIME_TYPES.has(mimeType)) {
      const heic = isHeicInput(mimeType, file.name, uploadBuffer);
      try {
        uploadBuffer = await toAvif(uploadBuffer, heic);
        uploadMimeType = "image/avif";
        uploadFilename = avifFilename(uploadFilename);
      } catch (convErr) {
        Sentry.captureException(convErr, { extra: { originalMimeType: mimeType } });
        return NextResponse.json({ error: "Image conversion failed" }, { status: 422 });
      }
    }

    // Build storage path
    const fileId = randomUUID();
    const storagePath = `${user.id}/${noteId}/${fileId}-${uploadFilename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from("note-attachments")
      .upload(storagePath, uploadBuffer, {
        contentType: uploadMimeType,
        upsert: false,
      });

    if (uploadError) {
      Sentry.captureException(new Error(`[attachments] Storage upload error: ${uploadError.message}`));
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    // Create DB record using the converted size
    const [attachment] = await db
      .insert(attachmentsTable)
      .values({
        noteId,
        userId: user.id,
        fileName: file.name,
        fileType: uploadMimeType,
        fileSize: uploadBuffer.length,
        storagePath,
      })
      .returning();

    // Generate signed URL (1 hour)
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
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
