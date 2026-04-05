import { type NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db, attachmentsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

// Escape a string for use in a RegExp
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strip all <img> tags whose src references the given storage path, then return
// updated { content, contentText }. Returns null if the note has no content or
// if no matching image is found (caller should skip the DB update).
function stripImageFromContent(
  content: string,
  storagePath: string
): { content: string; contentText: string } | null {
  const escaped = escapeRegExp(storagePath);
  const imgRegex = new RegExp(`<img[^>]*src="[^"]*${escaped}[^"]*"[^>]*/?>`, "gi");
  if (!imgRegex.test(content)) return null;

  const newContent = content.replace(imgRegex, "");
  const newContentText = newContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { content: newContent, contentText: newContentText };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await params;
  if (!attachmentId) return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });

  // Find the attachment and verify ownership (only active attachments)
  const [attachment] = await db
    .select()
    .from(attachmentsTable)
    .where(
      and(
        eq(attachmentsTable.id, attachmentId),
        eq(attachmentsTable.userId, user.id),
        isNull(attachmentsTable.deletedAt)
      )
    )
    .limit(1);

  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  // Soft-delete — set deletedAt, leave Storage file in place for the 30-day window
  await db
    .update(attachmentsTable)
    .set({ deletedAt: new Date() })
    .where(and(eq(attachmentsTable.id, attachmentId), eq(attachmentsTable.userId, user.id)));

  // For image attachments, strip the inline <img> node from the associated note content
  if (attachment.fileType.startsWith("image/")) {
    const [note] = await db
      .select({ id: notesTable.id, content: notesTable.content })
      .from(notesTable)
      .where(and(eq(notesTable.id, attachment.noteId), eq(notesTable.userId, user.id)))
      .limit(1);

    if (note?.content) {
      const stripped = stripImageFromContent(note.content, attachment.storagePath);
      if (stripped) {
        await db
          .update(notesTable)
          .set({ content: stripped.content, contentText: stripped.contentText, updatedAt: new Date() })
          .where(eq(notesTable.id, note.id));
      }
    }
  }

  return new NextResponse(null, { status: 204 });
}
