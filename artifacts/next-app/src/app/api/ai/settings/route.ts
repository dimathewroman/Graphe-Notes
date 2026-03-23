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
    const { activeAiProvider } = body;

    if (typeof activeAiProvider !== "string" || !activeAiProvider.trim()) {
      return NextResponse.json({ error: "activeAiProvider is required" }, { status: 400 });
    }

    const now = new Date();
    await db
      .insert(userSettingsTable)
      .values({ userId: user.id, activeAiProvider, updatedAt: now })
      .onConflictDoUpdate({
        target: userSettingsTable.userId,
        set: { activeAiProvider, updatedAt: now },
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
