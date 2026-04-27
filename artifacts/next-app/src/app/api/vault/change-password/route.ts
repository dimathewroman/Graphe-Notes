import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, vaultSettingsTable } from "@workspace/db";
import { ChangeVaultPasswordBody, ChangeVaultPasswordResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { vaultUnlockLimiter } from "@/lib/rate-limit";
import { verifyPin, hashPin } from "@/lib/vault-hash";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: shares the same unlock limiter — 5 attempts per 15 minutes per user
  const rl = await vaultUnlockLimiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = ChangeVaultPasswordBody.safeParse(body);
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

    const { valid } = await verifyPin(parsed.data.currentPin, settings.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Wrong current password" }, { status: 401 });
    }

    // Hash the new PIN server-side before storing
    const newHash = await hashPin(parsed.data.newPin);

    await db
      .update(vaultSettingsTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(
        and(eq(vaultSettingsTable.id, settings.id), eq(vaultSettingsTable.userId, user.id)),
      );

    return NextResponse.json(ChangeVaultPasswordResponse.parse({ isConfigured: true }));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
