import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { supabaseAdmin, getTokenFromRequest } from "../lib/auth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const token = getTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error) {
      if (error.status !== 401) {
        console.error("[auth] Supabase getUser error:", error.message);
      }
      next();
      return;
    }
    if (!user) {
      next();
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email ?? null,
      firstName: user.user_metadata?.full_name?.split(" ")[0] ?? user.user_metadata?.first_name ?? null,
      lastName: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ?? user.user_metadata?.last_name ?? null,
      profileImageUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    };

    req.user = authUser;

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
      .catch((err) => {
        console.error("[auth] User upsert failed:", err?.message ?? err);
      });
  } catch (err) {
    console.error("[auth] Unexpected error in auth middleware:", err);
  }

  next();
}
