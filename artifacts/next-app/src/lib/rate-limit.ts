/**
 * In-memory sliding-window rate limiter.
 *
 * Design goals:
 * - Zero external dependencies — works today with the in-process store.
 * - Swap-friendly: swap `InMemoryRateLimitStore` for a Redis/Upstash-backed
 *   implementation and the route code stays identical.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxAttempts: 5, windowMs: 15 * 60_000 });
 *   const result = await limiter.check(userId);
 *   if (!result.allowed) {
 *     return NextResponse.json({ error: "Too many attempts" }, {
 *       status: 429,
 *       headers: { "Retry-After": String(result.retryAfterSeconds) },
 *     });
 *   }
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest attempt expires and a new attempt can be made. */
  retryAfterSeconds: number;
  /** How many attempts remain in this window. */
  remaining: number;
}

export interface RateLimitStore {
  /** Record one attempt and return the updated state. */
  record(key: string): Promise<RateLimitResult>;
  /** Remove all stored state (for testing). */
  reset(key: string): Promise<void>;
}

export interface RateLimiterOptions {
  /** Maximum number of attempts allowed within the window. */
  maxAttempts: number;
  /** Duration of the sliding window in milliseconds. */
  windowMs: number;
}

// ---------------------------------------------------------------------------
// In-memory store (default)
// ---------------------------------------------------------------------------

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, number[]>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(opts: RateLimiterOptions) {
    this.maxAttempts = opts.maxAttempts;
    this.windowMs = opts.windowMs;
  }

  async record(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Prune timestamps older than the window
    const timestamps = (this.buckets.get(key) ?? []).filter(t => t > windowStart);

    const allowed = timestamps.length < this.maxAttempts;
    if (allowed) {
      timestamps.push(now);
    }

    this.buckets.set(key, timestamps);

    // Seconds until the earliest timestamp in the window expires
    const oldest = timestamps[0];
    const retryAfterSeconds =
      timestamps.length > 0
        ? Math.ceil((oldest + this.windowMs - now) / 1000)
        : 0;

    return {
      allowed,
      retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
      remaining: Math.max(0, this.maxAttempts - timestamps.length),
    };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export interface RateLimiter {
  /**
   * Record an attempt for `key` and return whether it is allowed.
   * The key should be a stable, per-user identifier (e.g. `userId`).
   */
  check(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

/**
 * Create a rate limiter backed by the in-memory store.
 * Replace `store` with a Redis-backed implementation when ready.
 */
export function createRateLimiter(
  opts: RateLimiterOptions,
  store?: RateLimitStore,
): RateLimiter {
  const s = store ?? new InMemoryRateLimitStore(opts);
  return {
    check: (key) => s.record(key),
    reset: (key) => s.reset(key),
  };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters (module-level singletons so state persists across
// requests within the same serverless instance)
// ---------------------------------------------------------------------------

/** 5 vault-unlock or change-password attempts per 15 minutes per user. */
export const vaultUnlockLimiter = createRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60_000,
});

/** 3 vault-setup attempts per hour per user. */
export const vaultSetupLimiter = createRateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60_000,
});
