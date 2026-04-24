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
 * JWT verification uses the Supabase JWKS endpoint so the middleware
 * always has the current signing key. jose caches the JWKS response
 * internally — no extra network round-trip per request after the first
 * fetch. The JWKS endpoint returns all active keys (including any
 * previously-used keys still in rotation), and jose selects the correct
 * one by matching the `kid` in the JWT header automatically.
 *
 * No additional env vars are required — NEXT_PUBLIC_SUPABASE_URL is
 * already in the environment.
 */

import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Module-level singleton — createRemoteJWKSet returns a function that
// fetches and caches the JWKS on first use, then refreshes when it
// encounters an unknown `kid`. This is safe at module scope in the
// Edge Runtime because the runtime is stateless between invocations
// but the module is re-used within a single instance lifetime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const JWKS = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
);

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

  try {
    await jwtVerify(token, JWKS, {
      // Validates the `iss` claim — rejects tokens not issued by this project.
      issuer: `${supabaseUrl}/auth/v1`,
    });
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
