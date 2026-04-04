import type { NextRequest } from "next/server";
import type { AuthUser } from "@workspace/api-zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

const AUTH_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_MAX_SIZE = 100;

interface CacheEntry {
  user: AuthUser;
  cachedAt: number;
}

const authCache = new Map<string, CacheEntry>();

function getCached(token: string): AuthUser | null {
  const entry = authCache.get(token);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > AUTH_CACHE_TTL_MS) {
    authCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCache(token: string, user: AuthUser): void {
  if (authCache.size >= AUTH_CACHE_MAX_SIZE) {
    // Evict the oldest entry (Map preserves insertion order)
    const oldest = authCache.keys().next().value;
    if (oldest !== undefined) authCache.delete(oldest);
  }
  authCache.set(token, { user, cachedAt: Date.now() });
}

function getTokenFromRequest(request: NextRequest): string | undefined {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return undefined;
}

function mapUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, string>;
}): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: meta.full_name?.split(" ")[0] ?? meta.first_name ?? null,
    lastName: meta.full_name?.split(" ").slice(1).join(" ") ?? meta.last_name ?? null,
    profileImageUrl: meta.avatar_url ?? meta.picture ?? null,
  };
}

export async function getAuthUser(
  request: NextRequest,
): Promise<{ user: AuthUser } | { user: null }> {
  const token = getTokenFromRequest(request);
  if (!token) return { user: null };

  const cached = getCached(token);
  if (cached) return { user: cached };

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      if (error.status !== 401) {
        console.error("[auth] Supabase getUser error:", error.message);
      }
      return { user: null };
    }
    if (!user) return { user: null };

    const authUser = mapUser(user);
    setCache(token, authUser);

    // Upsert user into DB — fire and forget, only on cache miss
    db.insert(usersTable)
      .values({
        id: authUser.id,
        email: authUser.email,
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        profileImageUrl: authUser.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: authUser.email,
          firstName: authUser.firstName,
          lastName: authUser.lastName,
          profileImageUrl: authUser.profileImageUrl,
        },
      })
      .execute()
      .catch((err: unknown) => {
        console.error("[auth] User upsert failed:", err instanceof Error ? err.message : err);
      });

    return { user: authUser };
  } catch (err) {
    console.error("[auth] Unexpected error:", err);
    return { user: null };
  }
}
