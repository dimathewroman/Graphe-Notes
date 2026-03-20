import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable, foldersTable } from "@workspace/db";
import {
  GetNoteParams,
  GetNoteResponse,
  UpdateNoteParams,
  UpdateNoteBody,
  UpdateNoteResponse,
  DeleteNoteParams,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = GetNoteParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
  }

  const [note] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)));

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(GetNoteResponse.parse(note));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = UpdateNoteParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
  }

  const body = await request.json();
  const parsed = UpdateNoteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const isContentChange =
    parsed.data.title !== undefined ||
    parsed.data.content !== undefined ||
    parsed.data.contentText !== undefined;

  let updatePayload: typeof parsed.data & { updatedAt?: Date; folderId?: number | null } =
    isContentChange ? { ...parsed.data, updatedAt: new Date() } : { ...parsed.data };

  // Auto-move note to a matching folder when tags are updated
  if (parsed.data.tags !== undefined) {
    const folders = await db
      .select()
      .from(foldersTable)
      .where(eq(foldersTable.userId, user.id));

    const matchingFolder = folders.find(
      (f) => f.tagRules?.length > 0 && parsed.data.tags!.some((t) => f.tagRules.includes(t)),
    );

    if (matchingFolder) {
      updatePayload = { ...updatePayload, folderId: matchingFolder.id };
    }
  }

  const [note] = await db
    .update(notesTable)
    .set(updatePayload)
    .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
    .returning();

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json(UpdateNoteResponse.parse(note));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = DeleteNoteParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
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
