import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, foldersTable } from "@workspace/db";
import {
  CreateFolderBody,
  UpdateFolderBody,
  UpdateFolderParams,
  DeleteFolderParams,
  GetFoldersResponse,
  UpdateFolderResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/folders", async (_req, res): Promise<void> => {
  const folders = await db
    .select()
    .from(foldersTable)
    .orderBy(foldersTable.sortOrder, foldersTable.name);
  res.json(GetFoldersResponse.parse(folders));
});

router.post("/folders", async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db
    .insert(foldersTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(UpdateFolderResponse.parse(folder));
});

router.patch("/folders/:id", async (req, res): Promise<void> => {
  const params = UpdateFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db
    .update(foldersTable)
    .set(parsed.data)
    .where(eq(foldersTable.id, params.data.id))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.json(UpdateFolderResponse.parse(folder));
});

router.delete("/folders/:id", async (req, res): Promise<void> => {
  const params = DeleteFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [folder] = await db
    .delete(foldersTable)
    .where(eq(foldersTable.id, params.data.id))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
