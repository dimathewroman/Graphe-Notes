import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, vaultSettingsTable } from "@workspace/db";
import { SetupVaultBody, SetupVaultResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  await db
    .insert(vaultSettingsTable)
    .values({ userId: user.id, passwordHash: parsed.data.passwordHash });

  return NextResponse.json(SetupVaultResponse.parse({ isConfigured: true }));
}
