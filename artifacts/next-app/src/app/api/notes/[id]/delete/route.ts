import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { SoftDeleteNoteParams, SoftDeleteNoteResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  return NextResponse.json(SoftDeleteNoteResponse.parse(note));
}
