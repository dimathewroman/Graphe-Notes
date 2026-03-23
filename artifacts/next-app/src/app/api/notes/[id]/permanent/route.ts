import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { PermanentDeleteNoteParams, PermanentDeleteNoteBody } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const [deleted] = await db
    .delete(notesTable)
    .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
