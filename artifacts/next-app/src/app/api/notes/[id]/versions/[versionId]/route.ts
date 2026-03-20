import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, noteVersionsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;
  const noteId = Number(id);
  const versionIdNum = Number(versionId);
  if (isNaN(noteId) || isNaN(versionIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [version] = await db
    .select()
    .from(noteVersionsTable)
    .where(
      and(eq(noteVersionsTable.id, versionIdNum), eq(noteVersionsTable.noteId, noteId)),
    );

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json({ version });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;
  const noteId = Number(id);
  const versionIdNum = Number(versionId);
  if (isNaN(noteId) || isNaN(versionIdNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await db
    .delete(noteVersionsTable)
    .where(
      and(eq(noteVersionsTable.id, versionIdNum), eq(noteVersionsTable.noteId, noteId)),
    );

  return NextResponse.json({ deleted: true });
}
