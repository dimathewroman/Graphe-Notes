import type { NextRequest } from "next/server";
import type { AuthUser } from "@workspace/api-zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

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

    // Upsert user into DB — fire and forget
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
