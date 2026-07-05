import { type NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db, attachmentsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

// How long a display signed URL is valid. Short-lived — the client re-signs on
// each render (X-A1), so this only needs to cover a viewing session.
const DISPLAY_URL_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * GET /api/attachments/sign?id={attachmentId}
 *
 * Returns a fresh short-lived signed URL for the attachment's DISPLAY image
 * (proxy for v2, storagePath for v1). Used by ImageNodeView to re-resolve inline
 * images at render time instead of relying on a long-lived signed URL baked into
 * notes.content (X-A1: baked 7-day URLs 400 after expiry). Bearer-authed via
 * getAuthUser and scoped to the owning user, so it's safe to expose.
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const [attachment] = await db
      .select({
        storagePath: attachmentsTable.storagePath,
        proxyPath: attachmentsTable.proxyPath,
        masterPath: attachmentsTable.masterPath,
      })
      .from(attachmentsTable)
      .where(
        and(
          eq(attachmentsTable.id, id),
          eq(attachmentsTable.userId, user.id),
          isNull(attachmentsTable.deletedAt),
        ),
      )
      .limit(1);

    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Prefer the display proxy (webp) for v2 rows; fall back to the v1 single path
    // or the master.
    const displayPath =
      attachment.proxyPath ?? attachment.storagePath ?? attachment.masterPath;
    if (!displayPath) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const { data, error } = await supabaseAdmin.storage
      .from("note-attachments")
      .createSignedUrl(displayPath, DISPLAY_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
