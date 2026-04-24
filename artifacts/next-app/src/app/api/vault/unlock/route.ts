import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, vaultSettingsTable } from "@workspace/db";
import { UnlockVaultBody, UnlockVaultResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { vaultUnlockLimiter } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 5 attempts per 15 minutes per user
  const rl = await vaultUnlockLimiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many unlock attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const body = await request.json();
  const parsed = UnlockVaultBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [settings] = await db
    .select()
    .from(vaultSettingsTable)
    .where(eq(vaultSettingsTable.userId, user.id))
    .limit(1);

  if (!settings) {
    return NextResponse.json({ error: "Vault not configured" }, { status: 404 });
  }

  if (settings.passwordHash !== parsed.data.passwordHash) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  getPostHogClient().capture({ distinctId: user.id, event: "vault_unlocked" });
  return NextResponse.json(UnlockVaultResponse.parse({ success: true }));
}
