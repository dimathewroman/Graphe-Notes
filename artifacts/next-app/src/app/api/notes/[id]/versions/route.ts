import { type NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count } from "drizzle-orm";
import { db, noteVersionsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

const MAX_VERSIONS = 50;
const MIN_INTERVAL_MS = 5 * 60 * 1000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const noteId = Number(id);
  if (isNaN(noteId)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  const versions = await db
    .select({
      id: noteVersionsTable.id,
      noteId: noteVersionsTable.noteId,
      title: noteVersionsTable.title,
      contentText: noteVersionsTable.contentText,
      createdAt: noteVersionsTable.createdAt,
    })
    .from(noteVersionsTable)
    .where(eq(noteVersionsTable.noteId, noteId))
    .orderBy(desc(noteVersionsTable.createdAt))
    .limit(MAX_VERSIONS);

  return NextResponse.json({ versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const noteId = Number(id);
  if (isNaN(noteId)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  const [note] = await db.select().from(notesTable).where(eq(notesTable.id, noteId));
  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  // Enforce minimum interval
  const [latest] = await db
    .select({ createdAt: noteVersionsTable.createdAt })
    .from(noteVersionsTable)
    .where(eq(noteVersionsTable.noteId, noteId))
    .orderBy(desc(noteVersionsTable.createdAt))
    .limit(1);

  if (latest) {
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age < MIN_INTERVAL_MS) {
      return NextResponse.json({ created: false, reason: "too_soon" });
    }
  }

  const [created] = await db
    .insert(noteVersionsTable)
    .values({
      noteId,
      title: note.title,
      content: note.content,
      contentText: note.contentText ?? null,
    })
    .returning();

  // Prune oldest beyond MAX_VERSIONS
  const [{ total }] = await db
    .select({ total: count() })
    .from(noteVersionsTable)
    .where(eq(noteVersionsTable.noteId, noteId));

  if (total > MAX_VERSIONS) {
    const oldest = await db
      .select({ id: noteVersionsTable.id })
      .from(noteVersionsTable)
      .where(eq(noteVersionsTable.noteId, noteId))
      .orderBy(desc(noteVersionsTable.createdAt))
      .offset(MAX_VERSIONS);
    for (const row of oldest) {
      await db.delete(noteVersionsTable).where(eq(noteVersionsTable.id, row.id));
    }
  }

  return NextResponse.json({ created: true, version: created });
}
