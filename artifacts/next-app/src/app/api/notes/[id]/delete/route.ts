import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { SoftDeleteNoteParams, SoftDeleteNoteResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import * as Sentry from "@sentry/nextjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const routeParams = SoftDeleteNoteParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
    }

    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + 30 * 86_400_000);

    const [note] = await db
      .update(notesTable)
      .set({ deletedAt: now, autoDeleteAt, deletedReason: "deleted" })
      .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
      .returning();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    getPostHogClient().capture({ distinctId: user.id, event: "note_deleted", properties: { note_id: note.id } });
    return NextResponse.json(SoftDeleteNoteResponse.parse(note));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
