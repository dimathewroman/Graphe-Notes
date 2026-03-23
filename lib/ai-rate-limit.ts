import { db, aiUsageTable } from "@workspace/db";
import { eq, sum } from "drizzle-orm";

export const HOURLY_LIMIT_PER_USER = 5;
export const MONTHLY_LIMIT_GLOBAL = 100_000;

export type RateLimitResult = {
  allowed: boolean;
  reason: string | null;
  hourlyUsed: number;
  hourlyLimit: number;
  monthlyUsed: number; // global sum across all users, not per-user
  resetInMs: number;
};

export async function checkAndIncrementUsage(userId: string): Promise<RateLimitResult> {
  const now = new Date();

  // --- Fetch or create row ---
  let rows = await db.select().from(aiUsageTable).where(eq(aiUsageTable.userId, userId));

  if (rows.length === 0) {
    await db
      .insert(aiUsageTable)
      .values({ userId, hourWindowStart: now, monthWindowStart: now })
      .onConflictDoNothing();
    rows = await db.select().from(aiUsageTable).where(eq(aiUsageTable.userId, userId));
  }

  const row = rows[0];
  if (!row) {
    // Extremely unlikely — insert + re-select both returned nothing
    throw new Error(`Failed to fetch or create ai_usage row for user ${userId}`);
  }

  // --- Apply window resets in memory ---
  const HOUR_MS = 60 * 60 * 1000;
  const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  let hourlyReset = false;
  let monthlyReset = false;

  if (now.getTime() > row.hourWindowStart.getTime() + HOUR_MS) {
    row.requestsThisHour = 0;
    row.hourWindowStart = now;
    hourlyReset = true;
  }

  if (now.getTime() > row.monthWindowStart.getTime() + MONTH_MS) {
    row.requestsThisMonth = 0;
    row.monthWindowStart = now;
    monthlyReset = true;
  }

  // --- Global monthly total (sum across all users) ---
  const sumResult = await db
    .select({ total: sum(aiUsageTable.requestsThisMonth) })
    .from(aiUsageTable);
  const globalTotal = Number(sumResult[0]?.total ?? 0);

  // resetInMs is always relative to the (possibly just-reset) hourWindowStart
  const resetInMs = Math.max(0, row.hourWindowStart.getTime() + HOUR_MS - now.getTime());

  // Helper: flush window resets to DB when blocking (so stale counters don't persist)
  const flushResets = async () => {
    if (hourlyReset || monthlyReset) {
      await db
        .update(aiUsageTable)
        .set({
          ...(hourlyReset ? { requestsThisHour: 0, hourWindowStart: now } : {}),
          ...(monthlyReset ? { requestsThisMonth: 0, monthWindowStart: now } : {}),
        })
        .where(eq(aiUsageTable.userId, userId));
    }
  };

  // --- Hourly limit check ---
  if (row.requestsThisHour >= HOURLY_LIMIT_PER_USER) {
    await flushResets();
    return {
      allowed: false,
      reason: "hourly_limit_reached",
      hourlyUsed: row.requestsThisHour,
      hourlyLimit: HOURLY_LIMIT_PER_USER,
      monthlyUsed: globalTotal,
      resetInMs,
    };
  }

  // --- Global monthly circuit breaker ---
  if (globalTotal >= MONTHLY_LIMIT_GLOBAL) {
    await flushResets();
    return {
      allowed: false,
      reason: "monthly_limit_reached",
      hourlyUsed: row.requestsThisHour,
      hourlyLimit: HOURLY_LIMIT_PER_USER,
      monthlyUsed: globalTotal,
      resetInMs,
    };
  }

  // --- Allowed: persist increments + any resets in one UPDATE ---
  await db
    .update(aiUsageTable)
    .set({
      requestsThisHour: row.requestsThisHour + 1,
      requestsThisMonth: row.requestsThisMonth + 1,
      lastRequestAt: now,
      ...(hourlyReset ? { hourWindowStart: now } : {}),
      ...(monthlyReset ? { monthWindowStart: now } : {}),
    })
    .where(eq(aiUsageTable.userId, userId));

  // TODO: token tracking — write inputTokens + outputTokens to totalTokensUsed here when ready

  return {
    allowed: true,
    reason: null,
    hourlyUsed: row.requestsThisHour + 1,
    hourlyLimit: HOURLY_LIMIT_PER_USER,
    monthlyUsed: globalTotal + 1,
    resetInMs,
  };
}
