// GET    /api/notes/:id/versions/:versionId — fetch full version content
// PATCH  /api/notes/:id/versions/:versionId — update the user-defined label
// DELETE /api/notes/:id/versions/:versionId — delete a single version

import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, noteVersionsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

const routeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = routeParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const { id: noteId, versionId: versionIdNum } = parsed.data;

  try {
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

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
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = routeParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const { id: noteId, versionId: versionIdNum } = parsed.data;

  let body: { label?: string | null } = {};
  try {
    body = (await request.json()) as { label?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!("label" in body)) {
    return NextResponse.json({ error: "Missing label field" }, { status: 400 });
  }

  const normalised =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 200)
      : null;

  try {
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

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
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = routeParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const { id: noteId, versionId: versionIdNum } = parsed.data;

  try {
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    await db
      .delete(noteVersionsTable)
      .where(
        and(eq(noteVersionsTable.id, versionIdNum), eq(noteVersionsTable.noteId, noteId)),
      );

    return NextResponse.json({ deleted: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
