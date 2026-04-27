// GET  /api/notes/:id/versions  — list versions for a note (newest first)
// POST /api/notes/:id/versions  — create a new version (snapshot)
//
// POST body: { source?: VersionSource, label?: string | null }
//
// Snapshot policy:
//   - manual_save / pre_ai_rewrite / restore / auto_close → always create
//   - auto_save → only create if (a) ≥ 5 minutes since the last version, OR
//                 (b) the contentText length differs from the last version by
//                 more than ~100 characters (a meaningful change threshold).
//
// After creating, prune the oldest versions so each note keeps at most 50.

import { type NextRequest, NextResponse } from "next/server";
import { eq, and, desc, count } from "drizzle-orm";
import { z } from "zod";
import { db, noteVersionsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

const routeParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const MAX_VERSIONS = 50;
const AUTO_SAVE_MIN_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_SAVE_CHAR_DELTA_THRESHOLD = 100;

const VALID_SOURCES = new Set([
  "manual_save",
  "auto_save",
  "pre_ai_rewrite",
  "restore",
  "auto_close",
] as const);
type VersionSource = typeof VALID_SOURCES extends Set<infer T> ? T : never;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = routeParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }
  const noteId = parsed.data.id;

  try {
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)))
      .limit(1);
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    const versions = await db
      .select({
        id: noteVersionsTable.id,
        noteId: noteVersionsTable.noteId,
        title: noteVersionsTable.title,
        contentText: noteVersionsTable.contentText,
        label: noteVersionsTable.label,
        source: noteVersionsTable.source,
        createdAt: noteVersionsTable.createdAt,
      })
      .from(noteVersionsTable)
      .where(eq(noteVersionsTable.noteId, noteId))
      .orderBy(desc(noteVersionsTable.createdAt))
      .limit(MAX_VERSIONS);

    return NextResponse.json({ versions });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = routeParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }
  const noteId = parsed.data.id;

  let body: { source?: string; label?: string | null } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // Empty / invalid body — fall through with defaults
  }

  const source: VersionSource = VALID_SOURCES.has(body.source as VersionSource)
    ? (body.source as VersionSource)
    : "auto_save";
  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 200)
      : null;

  try {
    const [note] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)));
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Auto-save uses a meaningful-change threshold to avoid hundreds of trivial
    // versions during an active editing session. All other sources bypass it.
    if (source === "auto_save") {
      const [latest] = await db
        .select({
          createdAt: noteVersionsTable.createdAt,
          contentText: noteVersionsTable.contentText,
        })
        .from(noteVersionsTable)
        .where(eq(noteVersionsTable.noteId, noteId))
        .orderBy(desc(noteVersionsTable.createdAt))
        .limit(1);

      if (latest) {
        const age = Date.now() - new Date(latest.createdAt).getTime();
        const prevLen = latest.contentText?.length ?? 0;
        const currLen = note.contentText?.length ?? 0;
        const delta = Math.abs(currLen - prevLen);
        const meetsThreshold =
          age >= AUTO_SAVE_MIN_INTERVAL_MS || delta > AUTO_SAVE_CHAR_DELTA_THRESHOLD;
        if (!meetsThreshold) {
          return NextResponse.json({ created: false, reason: "below_threshold" });
        }
      }
    }

    const [created] = await db
      .insert(noteVersionsTable)
      .values({
        noteId,
        userId: user.id,
        title: note.title,
        content: note.content,
        contentText: note.contentText ?? null,
        label,
        source,
      })
      .returning();

    // Prune oldest beyond MAX_VERSIONS so each note keeps at most 50.
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
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
