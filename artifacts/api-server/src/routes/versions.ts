import { Router, type IRouter } from "express";
import { db, noteVersionsTable, notesTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";

const router: IRouter = Router();

const MAX_VERSIONS = 50;
const MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

router.get("/notes/:id/versions", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const noteId = Number(req.params.id);
  if (isNaN(noteId)) { res.status(400).json({ error: "Invalid note id" }); return; }

  const versions = await db
    .select({ id: noteVersionsTable.id, noteId: noteVersionsTable.noteId, title: noteVersionsTable.title, contentText: noteVersionsTable.contentText, createdAt: noteVersionsTable.createdAt })
    .from(noteVersionsTable)
    .where(eq(noteVersionsTable.noteId, noteId))
    .orderBy(desc(noteVersionsTable.createdAt))
    .limit(MAX_VERSIONS);

  res.json({ versions });
});

router.get("/notes/:id/versions/:versionId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const noteId = Number(req.params.id);
  const versionId = Number(req.params.versionId);
  if (isNaN(noteId) || isNaN(versionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [version] = await db
    .select()
    .from(noteVersionsTable)
    .where(and(eq(noteVersionsTable.id, versionId), eq(noteVersionsTable.noteId, noteId)));

  if (!version) { res.status(404).json({ error: "Version not found" }); return; }
  res.json({ version });
});

router.post("/notes/:id/versions", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const noteId = Number(req.params.id);
  if (isNaN(noteId)) { res.status(400).json({ error: "Invalid note id" }); return; }

  // Check if note exists
  const [note] = await db.select().from(notesTable).where(eq(notesTable.id, noteId));
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }

  // Enforce minimum interval — check most recent version timestamp
  const [latest] = await db
    .select({ createdAt: noteVersionsTable.createdAt })
    .from(noteVersionsTable)
    .where(eq(noteVersionsTable.noteId, noteId))
    .orderBy(desc(noteVersionsTable.createdAt))
    .limit(1);

  if (latest) {
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age < MIN_INTERVAL_MS) {
      res.json({ created: false, reason: "too_soon" });
      return;
    }
  }

  // Insert new version
  const [created] = await db.insert(noteVersionsTable).values({
    noteId,
    title: note.title,
    content: note.content,
    contentText: note.contentText ?? null,
  }).returning();

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

  res.json({ created: true, version: created });
});

router.delete("/notes/:id/versions/:versionId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const noteId = Number(req.params.id);
  const versionId = Number(req.params.versionId);
  if (isNaN(noteId) || isNaN(versionId)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(noteVersionsTable).where(
    and(eq(noteVersionsTable.id, versionId), eq(noteVersionsTable.noteId, noteId))
  );
  res.json({ deleted: true });
});

export default router;
