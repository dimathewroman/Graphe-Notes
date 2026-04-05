// POST /api/notes/:id/versions/:versionId/restore
//
// Prepares version content for restoration:
// - Soft-deleted attachment referenced by an image in the version? Restore it (clear deleted_at).
// - Attachment hard-purged (not in DB at all)? Replace the <img> with a text placeholder.
// - Active attachment? Leave it alone.
//
// Returns { content, title } with the processed content ready to load into the editor.

import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, noteVersionsTable, notesTable, attachmentsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

// Extract the storage path from a Supabase signed or public URL.
// Signed URL: .../object/sign/note-attachments/<path>?token=...
// Public URL:  .../object/public/note-attachments/<path>
function extractStoragePath(src: string): string | null {
  const match = src.match(/\/object\/(?:sign|public)\/note-attachments\/([^?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Replace a single <img> tag (matched by its exact src value) with a placeholder paragraph.
function replaceImgWithPlaceholder(content: string, src: string): string {
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<img[^>]*src="${escaped}"[^>]*/?>`, "gi");
  return content.replace(
    regex,
    '<p><em style="opacity:0.5">⚠ Image no longer available</em></p>'
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;
  const noteId = Number(id);
  const versionIdNum = Number(versionId);
  if (isNaN(noteId) || isNaN(versionIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Verify the note belongs to this user
  const [note] = await db
    .select({ id: notesTable.id })
    .from(notesTable)
    .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
    .limit(1);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  // Fetch the version
  const [version] = await db
    .select()
    .from(noteVersionsTable)
    .where(and(eq(noteVersionsTable.id, versionIdNum), eq(noteVersionsTable.noteId, noteId)))
    .limit(1);
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  let content: string = version.content ?? "";

  // Extract all <img src="..."> values from the HTML
  const imgSrcRegex = /<img[^>]+src="([^"]+)"/gi;
  const srcs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = imgSrcRegex.exec(content)) !== null) {
    srcs.push(m[1]);
  }

  for (const src of srcs) {
    const storagePath = extractStoragePath(src);
    if (!storagePath) continue; // URL-linked image, not a Supabase upload — skip

    // Look up the attachment (including soft-deleted ones)
    const [attachment] = await db
      .select({ id: attachmentsTable.id, deletedAt: attachmentsTable.deletedAt })
      .from(attachmentsTable)
      .where(
        and(eq(attachmentsTable.storagePath, storagePath), eq(attachmentsTable.userId, user.id))
      )
      .limit(1);

    if (!attachment) {
      // Hard-purged — replace with placeholder
      content = replaceImgWithPlaceholder(content, src);
    } else if (attachment.deletedAt !== null) {
      // Soft-deleted but still within retention window — restore it
      await db
        .update(attachmentsTable)
        .set({ deletedAt: null })
        .where(eq(attachmentsTable.id, attachment.id));
    }
    // else: active, nothing to do
  }

  return NextResponse.json({ content, title: version.title });
}
