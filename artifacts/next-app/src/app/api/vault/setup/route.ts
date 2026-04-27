import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, vaultSettingsTable } from "@workspace/db";
import { SetupVaultBody, SetupVaultResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { vaultSetupLimiter } from "@/lib/rate-limit";
import { hashPin } from "@/lib/vault-hash";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 3 setup attempts per hour per user
  const rl = await vaultSetupLimiter.check(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many setup attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = SetupVaultBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(vaultSettingsTable)
      .where(eq(vaultSettingsTable.userId, user.id))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Vault is already configured" }, { status: 409 });
    }

    // Hash the PIN server-side before storing
    const passwordHash = await hashPin(parsed.data.pin);

    await db
      .insert(vaultSettingsTable)
      .values({ userId: user.id, passwordHash });

    getPostHogClient().capture({ distinctId: user.id, event: "vault_setup_completed" });
    return NextResponse.json(SetupVaultResponse.parse({ isConfigured: true }));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
