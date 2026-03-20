import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { MoveNoteParams, MoveNoteBody, MoveNoteResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = MoveNoteParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
  }

  const body = await request.json();
  const parsed = MoveNoteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [note] = await db
    .update(notesTable)
    .set({ folderId: parsed.data.folderId })
    .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
    .returning();

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(MoveNoteResponse.parse(note));
}
