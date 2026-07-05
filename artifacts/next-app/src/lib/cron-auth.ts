import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

/**
 * Authenticate a Vercel cron request via the CRON_SECRET bearer token.
 *
 * Fail-closed: if CRON_SECRET is unset we return 500 rather than accepting the
 * literal `Bearer undefined` (which an attacker could send). The comparison is
 * constant-time to avoid leaking the secret via response timing.
 */
export function verifyCronAuth(authHeader: string | null): CronAuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    Sentry.captureException(new Error("CRON_SECRET is not set — rejecting cron request"));
    return { ok: false, status: 500, error: "Server misconfiguration" };
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authHeader ?? "");
  // timingSafeEqual throws on length mismatch, so guard length first (a length
  // check leaks only the token length, which is not secret).
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
