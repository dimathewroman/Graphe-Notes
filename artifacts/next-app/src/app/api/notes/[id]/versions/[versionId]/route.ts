// GET    /api/notes/:id/versions/:versionId — fetch full version content
// PATCH  /api/notes/:id/versions/:versionId — update the user-defined label
// DELETE /api/notes/:id/versions/:versionId — delete a single version

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

export async function PATCH(
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

  let body: { label?: string | null } = {};
  try {
    body = (await request.json()) as { label?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!("label" in body)) {
    return NextResponse.json({ error: "Missing label field" }, { status: 400 });
  }

  // Empty string and null both clear the label.
  const normalised =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 200)
      : null;

  const [updated] = await db
    .update(noteVersionsTable)
    .set({ label: normalised })
    .where(
      and(eq(noteVersionsTable.id, versionIdNum), eq(noteVersionsTable.noteId, noteId)),
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json({ version: updated });
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
