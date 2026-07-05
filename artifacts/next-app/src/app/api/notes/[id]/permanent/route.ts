import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { PermanentDeleteNoteParams, PermanentDeleteNoteBody } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { purgeNoteChildren } from "@/lib/note-cleanup";
import * as Sentry from "@sentry/nextjs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const routeParams = PermanentDeleteNoteParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
    }

    const body = await request.json();
    const parsed = PermanentDeleteNoteBody.safeParse(body);
    if (!parsed.success || parsed.data.confirm !== true) {
      return NextResponse.json({ error: "confirm: true is required" }, { status: 400 });
    }

    // Verify ownership BEFORE deleting anything — purgeNoteChildren is scoped by
    // noteId only, so we must confirm this user owns the note first.
    const [owned] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
      .limit(1);

    if (!owned) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // X-R1/X-R2: remove the note's attachments (rows + storage) and version
    // snapshots BEFORE the note row — the child FKs are ON DELETE RESTRICT.
    await purgeNoteChildren([owned.id]);

    await db
      .delete(notesTable)
      .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)));

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
