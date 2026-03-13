import { Router, type IRouter } from "express";
import { eq, ilike, and, or, sql } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  CreateNoteBody,
  UpdateNoteBody,
  UpdateNoteParams,
  GetNoteParams,
  DeleteNoteParams,
  ToggleNotePinParams,
  ToggleNoteFavoriteParams,
  MoveNoteParams,
  MoveNoteBody,
  GetNotesQueryParams,
  GetNotesResponse,
  GetNoteResponse,
  UpdateNoteResponse,
  ToggleNotePinResponse,
  ToggleNoteFavoriteResponse,
  MoveNoteResponse,
  ToggleNoteVaultParams,
  ToggleNoteVaultBody,
  ToggleNoteVaultResponse,
} from "@workspace/api-zod";
import { desc, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/notes", async (req, res): Promise<void> => {
  const query = GetNotesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { folderId, search, pinned, favorite, tag, sortBy, sortDir } = query.data;

  const conditions = [];

  if (folderId !== undefined && folderId !== null) {
    conditions.push(eq(notesTable.folderId, folderId));
  }

  if (pinned !== undefined && pinned !== null) {
    conditions.push(eq(notesTable.pinned, pinned));
  }

  if (favorite !== undefined && favorite !== null) {
    conditions.push(eq(notesTable.favorite, favorite));
  }

  if (search) {
    conditions.push(
      or(
        ilike(notesTable.title, `%${search}%`),
        ilike(notesTable.contentText, `%${search}%`)
      )
    );
  }

  if (tag) {
    conditions.push(sql`${notesTable.tags} @> ARRAY[${tag}]::text[]`);
  }

  const orderCol = sortBy === "title" ? notesTable.title : sortBy === "createdAt" ? notesTable.createdAt : notesTable.updatedAt;
  const orderDir = sortDir === "asc" ? asc(orderCol) : desc(orderCol);

  const notes = await db
    .select()
    .from(notesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderDir);

  res.json(GetNotesResponse.parse(notes));
});

router.post("/notes", async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db.insert(notesTable).values(parsed.data).returning();
  res.status(201).json(GetNoteResponse.parse(note));
});

router.get("/notes/:id", async (req, res): Promise<void> => {
  const params = GetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [note] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(GetNoteResponse.parse(note));
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isContentChange = parsed.data.title !== undefined || parsed.data.content !== undefined || parsed.data.contentText !== undefined;
  const updatePayload = isContentChange
    ? { ...parsed.data, updatedAt: new Date() }
    : { ...parsed.data };

  const [note] = await db
    .update(notesTable)
    .set(updatePayload)
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(UpdateNoteResponse.parse(note));
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(notesTable)
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json({ success: true });
});

router.patch("/notes/:id/pin", async (req, res): Promise<void> => {
  const params = ToggleNotePinParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const [note] = await db
    .update(notesTable)
    .set({ pinned: !existing.pinned })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  res.json(ToggleNotePinResponse.parse(note));
});

router.patch("/notes/:id/favorite", async (req, res): Promise<void> => {
  const params = ToggleNoteFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const [note] = await db
    .update(notesTable)
    .set({ favorite: !existing.favorite })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  res.json(ToggleNoteFavoriteResponse.parse(note));
});

router.patch("/notes/:id/move", async (req, res): Promise<void> => {
  const params = MoveNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = MoveNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db
    .update(notesTable)
    .set({ folderId: parsed.data.folderId })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(MoveNoteResponse.parse(note));
});

router.patch("/notes/:id/vault", async (req, res): Promise<void> => {
  const params = ToggleNoteVaultParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = ToggleNoteVaultBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [note] = await db
    .update(notesTable)
    .set({ vaulted: parsed.data.vaulted })
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(ToggleNoteVaultResponse.parse(note));
});

export default router;
