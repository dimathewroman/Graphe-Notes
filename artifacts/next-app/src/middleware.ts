/**
 * Next.js auth middleware — defense-in-depth layer (WARNING-6).
 *
 * Validates the Supabase JWT for all /api/* routes before the request
 * reaches any route handler. Individual handlers still call getAuthUser()
 * themselves; this middleware catches any route where that check was
 * accidentally omitted.
 *
 * Exemptions:
 *   /api/healthz          — public health-check endpoint
 *   /api/cron/*           — cron jobs authenticate via CRON_SECRET header
 *
 * JWT verification is done locally against SUPABASE_JWT_SECRET so there
 * is no extra network round-trip. The token is not looked up in the DB —
 * signature validity and expiry are sufficient at this layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, type JWTPayload } from "jose";

// Routes that do not require a user JWT
const PUBLIC_API_PREFIXES = ["/api/healthz", "/api/cron/"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only gate /api/* routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow exempted routes through without a token
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const token = extractToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    // Misconfiguration: fail open in development, fail closed in production
    if (process.env.NODE_ENV === "production") {
      console.error("[middleware] SUPABASE_JWT_SECRET is not set — rejecting all API requests");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }
    // In dev without the secret configured, let the route handler's own
    // getAuthUser() call do the validation against Supabase directly.
    console.warn("[middleware] SUPABASE_JWT_SECRET not set; skipping middleware JWT check in development");
    return NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    await jwtVerify(token, secret) as { payload: JWTPayload };
    return NextResponse.next();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
}

export const config = {
  matcher: [
    /*
     * Match all /api/* paths. The :path* syntax captures the full remainder,
     * including nested segments. Next.js runs middleware only on matched paths.
     */
    "/api/:path*",
  ],
};
