import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, aiUsageTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { HOURLY_LIMIT_PER_USER } from "@lib/ai-rate-limit";

// GET /api/ai/usage — returns the authenticated user's current usage against the free tier limits
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(aiUsageTable)
      .where(eq(aiUsageTable.userId, user.id));

    const row = rows[0];
    if (!row) {
      return NextResponse.json({
        hourlyUsed: 0,
        hourlyLimit: HOURLY_LIMIT_PER_USER,
        resetInMs: 0,
      });
    }

    const hourWindowEndMs = row.hourWindowStart.getTime() + 60 * 60 * 1000;
    const resetInMs = Math.max(0, hourWindowEndMs - Date.now());

    return NextResponse.json({
      hourlyUsed: row.requestsThisHour,
      hourlyLimit: HOURLY_LIMIT_PER_USER,
      resetInMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
