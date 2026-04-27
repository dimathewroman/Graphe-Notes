import { type NextRequest, NextResponse } from "next/server";
import { eq, and, asc, isNull } from "drizzle-orm";
import { db, attachmentsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { noteId: noteIdStr } = await params;
    const noteId = Number(noteIdStr);
    if (!Number.isInteger(noteId) || noteId <= 0) {
      return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });
    }

    // Verify note ownership
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const attachments = await db
      .select()
      .from(attachmentsTable)
      .where(and(
        eq(attachmentsTable.noteId, noteId),
        eq(attachmentsTable.userId, user.id),
        isNull(attachmentsTable.deletedAt)
      ))
      .orderBy(asc(attachmentsTable.createdAt));

    // Generate signed URLs for each attachment
    const withUrls = await Promise.all(
      attachments.map(async (a) => {
        const { data } = await supabaseAdmin.storage
          .from("note-attachments")
          .createSignedUrl(a.storagePath, 3600);
        return { ...a, url: data?.signedUrl ?? null };
      })
    );

    return NextResponse.json(withUrls);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
