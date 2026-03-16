import { Router, type IRouter } from "express";
import { db, notesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { GetTagsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tags", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user.id;
  // Unnest the tags array column and get unique values for this user
  const result = await db.execute(
    sql`SELECT DISTINCT unnest(tags) as tag FROM notes WHERE user_id = ${userId} ORDER BY tag`
  );
  const tags = result.rows.map((row: Record<string, unknown>) => row.tag as string).filter(Boolean);
  res.json(GetTagsResponse.parse(tags));
});

export default router;
