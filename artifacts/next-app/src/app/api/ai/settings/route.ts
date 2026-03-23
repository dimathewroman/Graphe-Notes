import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

// GET /api/ai/settings — returns the user's active AI provider preference
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, user.id));

    return NextResponse.json({
      activeAiProvider: rows[0]?.activeAiProvider ?? null,
      hasCompletedAiSetup: rows[0]?.hasCompletedAiSetup ?? false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/ai/settings — upsert the user's active AI provider preference
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { activeAiProvider, hasCompletedAiSetup } = body;

    // activeAiProvider must be null or a non-empty string (if provided)
    if (
      "activeAiProvider" in body &&
      activeAiProvider !== null &&
      (typeof activeAiProvider !== "string" || !activeAiProvider.trim())
    ) {
      return NextResponse.json(
        { error: "activeAiProvider must be a non-empty string or null" },
        { status: 400 }
      );
    }

    if ("hasCompletedAiSetup" in body && typeof hasCompletedAiSetup !== "boolean") {
      return NextResponse.json(
        { error: "hasCompletedAiSetup must be a boolean" },
        { status: 400 }
      );
    }

    // Build the set clause from only the fields present in the request
    const now = new Date();
    const setClause: Partial<typeof userSettingsTable.$inferInsert> & { updatedAt: Date } = {
      updatedAt: now,
    };
    if ("activeAiProvider" in body) {
      setClause.activeAiProvider = (activeAiProvider as string | null) ?? null;
    }
    if ("hasCompletedAiSetup" in body) {
      setClause.hasCompletedAiSetup = hasCompletedAiSetup as boolean;
    }

    // Build insert values — include all provided fields plus userId
    const insertValues: typeof userSettingsTable.$inferInsert = {
      userId: user.id,
      updatedAt: now,
      ...("activeAiProvider" in body ? { activeAiProvider: (activeAiProvider as string | null) ?? null } : {}),
      ...("hasCompletedAiSetup" in body ? { hasCompletedAiSetup: hasCompletedAiSetup as boolean } : {}),
    };

    await db
      .insert(userSettingsTable)
      .values(insertValues)
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: setClause,
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
