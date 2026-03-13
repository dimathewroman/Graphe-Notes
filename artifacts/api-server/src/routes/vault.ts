import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, vaultSettingsTable } from "@workspace/db";
import {
  SetupVaultBody,
  SetupVaultResponse,
  UnlockVaultBody,
  UnlockVaultResponse,
  GetVaultStatusResponse,
  ChangeVaultPasswordBody,
  ChangeVaultPasswordResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vault/status", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(vaultSettingsTable).limit(1);
  res.json(GetVaultStatusResponse.parse({ isConfigured: !!settings }));
});

router.post("/vault/setup", async (req, res): Promise<void> => {
  const parsed = SetupVaultBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(vaultSettingsTable).limit(1);
  if (existing) {
    res.status(409).json({ error: "Vault is already configured" });
    return;
  }

  await db.insert(vaultSettingsTable).values({ passwordHash: parsed.data.passwordHash });
  res.json(SetupVaultResponse.parse({ isConfigured: true }));
});

router.post("/vault/unlock", async (req, res): Promise<void> => {
  const parsed = UnlockVaultBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [settings] = await db.select().from(vaultSettingsTable).limit(1);
  if (!settings) {
    res.status(404).json({ error: "Vault not configured" });
    return;
  }

  if (settings.passwordHash !== parsed.data.passwordHash) {
    res.status(401).json({ error: "Wrong password" });
    return;
  }

  res.json(UnlockVaultResponse.parse({ success: true }));
});

router.post("/vault/change-password", async (req, res): Promise<void> => {
  const parsed = ChangeVaultPasswordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [settings] = await db.select().from(vaultSettingsTable).limit(1);
  if (!settings) {
    res.status(404).json({ error: "Vault not configured" });
    return;
  }

  if (settings.passwordHash !== parsed.data.currentPasswordHash) {
    res.status(401).json({ error: "Wrong current password" });
    return;
  }

  await db.update(vaultSettingsTable)
    .set({ passwordHash: parsed.data.newPasswordHash, updatedAt: new Date() })
    .where(eq(vaultSettingsTable.id, settings.id));

  res.json(ChangeVaultPasswordResponse.parse({ isConfigured: true }));
});

export default router;
