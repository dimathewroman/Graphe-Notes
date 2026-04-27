import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, vaultSettingsTable } from "@workspace/db";
import { GetVaultStatusResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [settings] = await db
      .select()
      .from(vaultSettingsTable)
      .where(eq(vaultSettingsTable.userId, user.id))
      .limit(1);

    return NextResponse.json(GetVaultStatusResponse.parse({ isConfigured: !!settings }));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
