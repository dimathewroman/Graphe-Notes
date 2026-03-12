import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, smartFoldersTable } from "@workspace/db";
import {
  GetSmartFoldersResponse,
  CreateSmartFolderBody,
  UpdateSmartFolderBody,
} from "@workspace/api-zod";
import { z } from "zod/v4";

const router: IRouter = Router();

const IdParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/smart-folders", async (_req, res): Promise<void> => {
  const folders = await db.select().from(smartFoldersTable).orderBy(smartFoldersTable.sortOrder);
  res.json(GetSmartFoldersResponse.parse(folders));
});

router.post("/smart-folders", async (req, res): Promise<void> => {
  const parsed = CreateSmartFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [folder] = await db
    .insert(smartFoldersTable)
    .values({ ...parsed.data, tagRules: parsed.data.tagRules ?? [] })
    .returning();
  res.status(201).json(folder);
});

router.patch("/smart-folders/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSmartFolderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [folder] = await db
    .update(smartFoldersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(smartFoldersTable.id, params.data.id))
    .returning();
  if (!folder) { res.status(404).json({ error: "Not found" }); return; }
  res.json(folder);
});

router.delete("/smart-folders/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [folder] = await db
    .delete(smartFoldersTable)
    .where(eq(smartFoldersTable.id, params.data.id))
    .returning();
  if (!folder) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
