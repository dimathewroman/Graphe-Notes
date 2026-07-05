import { type NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db, attachmentsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

function contentTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "avif") return "image/avif";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "application/octet-stream";
}

/**
 * GET /api/attachments/download?id={attachmentId}   — v2 preferred
 * GET /api/attachments/download?path={storagePath}  — v1 legacy fallback
 *
 * v2: DB lookup by attachment ID, ownership verified via userId column.
 *     Serves master file (no transcoding) with original filename.
 * v1: path-prefix ownership check (first segment is user ID).
 *     Serves the stored AVIF directly (no transcoding).
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  const pathParam = request.nextUrl.searchParams.get("path");

  // ── v2: ID-based lookup ────────────────────────────────────────────────────
  if (id) {
    try {
      const [attachment] = await db
        .select()
        .from(attachmentsTable)
        .where(
          and(
            eq(attachmentsTable.id, id),
            eq(attachmentsTable.userId, user.id),
            isNull(attachmentsTable.deletedAt),
          )
        )
        .limit(1);

      if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

      // v2 rows have masterPath; v1 rows fall back to storagePath
      const servePath = attachment.masterPath ?? attachment.storagePath;
      if (!servePath) return NextResponse.json({ error: "File not found" }, { status: 404 });

      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from("note-attachments")
        .createSignedUrl(servePath, 60);

      if (signError || !signedData?.signedUrl) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });

      const fileBuffer = Buffer.from(await response.arrayBuffer());

      // Derive download filename: original name with correct extension
      const originalName = attachment.fileName ?? "image";
      const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const dotIdx = sanitized.lastIndexOf(".");
      const base = dotIdx !== -1 ? sanitized.slice(0, dotIdx) : sanitized;
      const ext = attachment.masterFormat ?? servePath.split(".").pop() ?? "bin";
      const downloadName = `${base}.${ext}`;

      const contentType = attachment.masterFormat === "png" ? "image/png"
        : attachment.masterFormat === "jpg" ? "image/jpeg"
        : contentTypeFromPath(servePath);

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${downloadName}"`,
          "Content-Length": String(fileBuffer.length),
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      Sentry.captureException(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── v1 legacy: path-based auth ─────────────────────────────────────────────
  if (pathParam) {
    // Reject traversal / percent-encoded segments before the prefix-ownership
    // check — otherwise `${userId}/../otheruser/file` would pass the first-segment
    // check yet resolve outside the user's prefix (§S).
    if (pathParam.includes("..") || pathParam.includes("%")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const [pathUserId] = pathParam.split("/");
    if (pathUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const { data: signedData, error: signError } = await supabaseAdmin.storage
        .from("note-attachments")
        .createSignedUrl(pathParam, 60);

      if (signError || !signedData?.signedUrl) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });

      const fileBuffer = Buffer.from(await response.arrayBuffer());

      // Derive filename: strip UUID prefix from the last path segment
      const rawName = pathParam.split("/").pop() ?? "image";
      const withoutUuid = rawName.replace(/^[0-9a-f-]{37}/, "");
      const downloadName = withoutUuid || rawName;

      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": contentTypeFromPath(pathParam),
          "Content-Disposition": `attachment; filename="${downloadName}"`,
          "Content-Length": String(fileBuffer.length),
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      Sentry.captureException(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "id or path is required" }, { status: 400 });
}
