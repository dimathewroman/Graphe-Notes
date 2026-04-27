import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, quickBitSettingsTable } from "@workspace/db";
import {
  GetQuickBitSettingsResponse,
  UpdateQuickBitSettingsBody,
  UpdateQuickBitSettingsResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    let [settings] = await db
      .select()
      .from(quickBitSettingsTable)
      .where(eq(quickBitSettingsTable.userId, user.id))
      .limit(1);

    // Auto-create default settings row if one doesn't exist yet
    if (!settings) {
      [settings] = await db
        .insert(quickBitSettingsTable)
        .values({ userId: user.id, defaultExpirationDays: 3 })
        .returning();
    }

    return NextResponse.json(GetQuickBitSettingsResponse.parse(settings));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = UpdateQuickBitSettingsBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    // Upsert: insert if missing, update if present
    const [settings] = await db
      .insert(quickBitSettingsTable)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({
        target: quickBitSettingsTable.userId,
        set: { ...parsed.data, updatedAt: new Date() },
      })
      .returning();

    return NextResponse.json(UpdateQuickBitSettingsResponse.parse(settings));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
