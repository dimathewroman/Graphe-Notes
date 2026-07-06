import { db, aiUsageTable } from "@workspace/db";
import { eq, sum, sql, and, or, lt } from "drizzle-orm";

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

const HOUR_MS = 60 * 60 * 1000;

/**
 * Atomically check-and-increment a user's AI usage.
 *
 * The hourly limit is enforced with a SINGLE conditional UPDATE
 * (`... WHERE requests_this_hour < LIMIT RETURNING`). Postgres takes a row lock
 * for the UPDATE and re-evaluates the WHERE against the locked row, so
 * concurrent requests can't both read "4 < 5" and both increment to 5 — exactly
 * one wins per slot (§S atomic rate-limit). The CASE expressions fold the
 * hourly/monthly window resets into the same statement so a stale counter can't
 * block a request whose window has rolled over.
 */
export async function checkAndIncrementUsage(userId: string): Promise<RateLimitResult> {
  const now = new Date();

  // Ensure the row exists (idempotent) so the atomic UPDATE below has a target.
  await db
    .insert(aiUsageTable)
    .values({ userId, hourWindowStart: now, monthWindowStart: now })
    .onConflictDoNothing();

  // Global monthly circuit breaker (soft, best-effort — a global aggregate, not
  // per-user billing). Checked before incrementing so we don't count a request
  // we're about to reject.
  const sumResult = await db
    .select({ total: sum(aiUsageTable.requestsThisMonth) })
    .from(aiUsageTable);
  const globalTotal = Number(sumResult[0]?.total ?? 0);

  const hourExpired = sql`${aiUsageTable.hourWindowStart} + interval '1 hour' < ${now}`;
  const monthExpired = sql`${aiUsageTable.monthWindowStart} + interval '30 days' < ${now}`;

  if (globalTotal >= MONTHLY_LIMIT_GLOBAL) {
    const [row] = await db
      .select({
        requestsThisHour: aiUsageTable.requestsThisHour,
        hourWindowStart: aiUsageTable.hourWindowStart,
      })
      .from(aiUsageTable)
      .where(eq(aiUsageTable.userId, userId));
    const resetInMs = row
      ? Math.max(0, row.hourWindowStart.getTime() + HOUR_MS - now.getTime())
      : HOUR_MS;
    return {
      allowed: false,
      reason: "monthly_limit_reached",
      hourlyUsed: row?.requestsThisHour ?? 0,
      hourlyLimit: HOURLY_LIMIT_PER_USER,
      monthlyUsed: globalTotal,
      resetInMs,
    };
  }

  // Atomic per-user hourly increment. Updates only when the hour window has
  // expired (reset to 1) OR the current count is under the limit (+1); returns
  // no rows when the limit is hit inside a live window → blocked.
  const [updated] = await db
    .update(aiUsageTable)
    .set({
      requestsThisHour: sql`CASE WHEN ${hourExpired} THEN 1 ELSE ${aiUsageTable.requestsThisHour} + 1 END`,
      hourWindowStart: sql`CASE WHEN ${hourExpired} THEN ${now} ELSE ${aiUsageTable.hourWindowStart} END`,
      requestsThisMonth: sql`CASE WHEN ${monthExpired} THEN 1 ELSE ${aiUsageTable.requestsThisMonth} + 1 END`,
      monthWindowStart: sql`CASE WHEN ${monthExpired} THEN ${now} ELSE ${aiUsageTable.monthWindowStart} END`,
      lastRequestAt: now,
    })
    .where(
      and(
        eq(aiUsageTable.userId, userId),
        or(hourExpired, lt(aiUsageTable.requestsThisHour, HOURLY_LIMIT_PER_USER)),
      ),
    )
    .returning({
      requestsThisHour: aiUsageTable.requestsThisHour,
      hourWindowStart: aiUsageTable.hourWindowStart,
    });

  if (!updated) {
    // WHERE matched no row → limit reached inside a live hour window.
    const [row] = await db
      .select({
        requestsThisHour: aiUsageTable.requestsThisHour,
        hourWindowStart: aiUsageTable.hourWindowStart,
      })
      .from(aiUsageTable)
      .where(eq(aiUsageTable.userId, userId));
    const resetInMs = row
      ? Math.max(0, row.hourWindowStart.getTime() + HOUR_MS - now.getTime())
      : HOUR_MS;
    return {
      allowed: false,
      reason: "hourly_limit_reached",
      hourlyUsed: row?.requestsThisHour ?? HOURLY_LIMIT_PER_USER,
      hourlyLimit: HOURLY_LIMIT_PER_USER,
      monthlyUsed: globalTotal,
      resetInMs,
    };
  }

  const resetInMs = Math.max(0, updated.hourWindowStart.getTime() + HOUR_MS - now.getTime());
  return {
    allowed: true,
    reason: null,
    hourlyUsed: updated.requestsThisHour,
    hourlyLimit: HOURLY_LIMIT_PER_USER,
    monthlyUsed: globalTotal + 1,
    resetInMs,
  };
}

// G19 (Phase 9.4): accumulate the model's reported token usage per user. Runs for
// both the free tier (row already exists from checkAndIncrementUsage) and BYOK
// (upsert creates a token-only row). Best-effort — callers should not block the
// AI response on a failure here.
export async function recordTokenUsage(userId: string, tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const now = new Date();
  await db
    .insert(aiUsageTable)
    .values({
      userId,
      requestsThisHour: 0,
      hourWindowStart: now,
      requestsThisMonth: 0,
      monthWindowStart: now,
      totalTokensUsed: tokens,
    })
    .onConflictDoUpdate({
      target: aiUsageTable.userId,
      set: { totalTokensUsed: sql`COALESCE(${aiUsageTable.totalTokensUsed}, 0) + ${tokens}` },
    });
}
