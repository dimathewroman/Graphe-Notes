# Graphe Notes — Pre-Launch Security Audit Report

**Date:** 2026-04-23  
**Auditor:** Claude Code (Security Reviewer)  
**Branch:** chore/security-audit  
**Codebase:** master as of `5e36964361b51c9f9485082204abcf61c8105178`

## Overall Verdict: CONCERNS

The application has a solid auth pattern at the API layer — every route validates the auth token and scopes queries by userId. However, several critical and high-priority issues must be addressed before launch: missing Row Level Security (RLS) on all database tables, an IDOR vulnerability in note versions, no security headers, no rate limiting on auth-sensitive endpoints, a known SQL injection CVE in the installed drizzle-orm version, and SVG upload support enabling stored XSS.

---

## Critical Findings (must fix before launch)

### CRITICAL-1: No Row Level Security (RLS) on any database table

- **Location:** `lib/db/drizzle/0000_dashing_felicia_hardy.sql`, all tables
- **Risk:** If any code path bypasses the application layer (direct Supabase client usage, a misconfigured Supabase function, or the Supabase Dashboard REST API), **all user data is readable and writable by any authenticated Supabase user**. The anon key + a valid JWT is sufficient to query any table via PostgREST. Without RLS, the entire database is exposed.
- **Evidence:** The migration SQL contains no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or `CREATE POLICY` statements. Grep for `rls`, `row level security`, and `pgPolicy` across the entire codebase returns zero results in application code. The Drizzle schema files define no RLS configuration.
- **Fix:** For every table with a `user_id` column (`notes`, `folders`, `vault_settings`, `quick_bits`, `quick_bit_settings`, `smart_folders`, `attachments`, `user_api_keys`, `user_settings`, `ai_usage`, `users`):
  1. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
  2. Create SELECT/INSERT/UPDATE/DELETE policies that restrict access to `auth.uid() = user_id`
  3. For `note_versions`: either add a `user_id` column or create a policy that joins through `notes.user_id`
  4. For the `users` table: restrict to `auth.uid() = id`
  5. **VERIFY MANUALLY**: RLS may have been configured directly in the Supabase Dashboard. Check Settings → Database → Tables → each table's "RLS Enabled" toggle and existing policies. If RLS is already enabled in the dashboard but not in migrations, add the policies to migrations so they are version-controlled and reproducible.
- **Effort:** Medium (1-2 hours for policies, but needs careful testing)

### CRITICAL-2: IDOR vulnerability in note versions endpoints

- **Location:** `artifacts/next-app/src/app/api/notes/[id]/versions/route.ts:46-57` (GET), lines 92 (POST); `artifacts/next-app/src/app/api/notes/[id]/versions/[versionId]/route.ts:24-35` (GET), lines 69-76 (PATCH), lines 98-104 (DELETE)
- **Risk:** Any authenticated user can read, create, modify, or delete another user's note versions by guessing or enumerating `noteId` values. The versions endpoints query `noteVersionsTable` by `noteId` only — they do not verify that the note belongs to the authenticated user.
- **Evidence:**
  - `GET /api/notes/:id/versions` (line 56): `where(eq(noteVersionsTable.noteId, noteId))` — no userId filter
  - `POST /api/notes/:id/versions` (line 92): `where(eq(notesTable.id, noteId))` — fetches the note without userId check, then creates a version for it
  - `GET/PATCH/DELETE /api/notes/:id/versions/:versionId`: queries by `noteVersionsTable.noteId` only
  - Compare with the version **restore** endpoint (`versions/[versionId]/restore/route.ts:48-53`) which correctly verifies note ownership via `eq(notesTable.userId, user.id)` — proving the pattern is known but inconsistently applied.
- **Fix:** In every versions handler, add a note ownership check before querying versions:
  ```typescript
  const [note] = await db.select({ id: notesTable.id }).from(notesTable)
    .where(and(eq(notesTable.id, noteId), eq(notesTable.userId, user.id)));
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  ```
- **Effort:** Low (add ~5 lines to 3 route handlers)

### CRITICAL-3: drizzle-orm SQL injection vulnerability (CVE GHSA-gpj5-g38j-94v9)

- **Location:** `package.json` dependencies — `drizzle-orm@0.45.1`
- **Risk:** drizzle-orm < 0.45.2 has a known SQL injection vulnerability via improperly escaped SQL identifiers. An attacker who can control column names or table references in dynamic queries could execute arbitrary SQL.
- **Evidence:** `pnpm ls drizzle-orm` shows version 0.45.1 installed. `pnpm audit` flags this as a high-severity vulnerability.
- **Fix:** Update drizzle-orm to >= 0.45.2: `pnpm add drizzle-orm@latest --filter @workspace/db --filter @workspace/next-app`
- **Effort:** Low (version bump, run tests)

---

## Warning Findings (should fix before launch)

### WARNING-1: No security headers configured

- **Location:** `artifacts/next-app/next.config.ts`
- **Risk:** The application is served without Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Referrer-Policy, or Permissions-Policy headers. This exposes the app to clickjacking, MIME sniffing attacks, and makes XSS exploitation easier.
- **Evidence:** `next.config.ts` contains no `headers()` function. Only `rewrites()` for PostHog proxying is configured.
- **Fix:** Add a `headers()` async function to `nextConfig`:
  ```typescript
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com;" },
      ],
    }];
  },
  ```
- **Effort:** Low (add config, test CSP doesn't break functionality)

### WARNING-2: No rate limiting on vault unlock/change-password endpoints

- **Location:** `artifacts/next-app/src/app/api/vault/unlock/route.ts`, `artifacts/next-app/src/app/api/vault/change-password/route.ts`
- **Risk:** The vault PIN is compared as a client-side hash (line 28-29 of unlock, line 27-28 of change-password). Without rate limiting, an attacker with a valid session can brute-force the vault PIN hash by sending unlimited requests to `/api/vault/unlock`. A 4-6 digit PIN has at most 1M combinations; even hashed, the hash space is small enough to enumerate.
- **Evidence:** No rate limiting middleware exists anywhere in the codebase. Rate limiting is only implemented for the AI generation endpoint (`lib/ai-rate-limit.ts`) and is specific to that feature.
- **Fix:**
  1. Add rate limiting middleware (e.g., `@upstash/ratelimit` with Vercel KV, or an in-memory sliding window for MVP) to vault unlock and change-password endpoints — e.g., 5 attempts per 15 minutes per user.
  2. Consider adding account lockout after N failed attempts.
  3. Also add rate limiting to login/signup endpoints (Supabase handles this partially, but additional server-side limits are good defense-in-depth).
- **Effort:** Medium

### WARNING-3: SVG uploads allow stored XSS

- **Location:** `artifacts/next-app/src/lib/attachment-limits.ts:11` — `"image/svg+xml"` in ALLOWED_MIME_TYPES
- **Risk:** SVG files can contain embedded `<script>` tags, `onload` event handlers, and other active content. If a signed URL to a malicious SVG is opened directly in the browser (not embedded via `<img>` tag), the script executes in the context of the Supabase storage domain. While this doesn't directly compromise the app domain, it could be used for phishing or social engineering. If sharing/collaboration features are added later and SVGs are rendered inline, this becomes a direct XSS vector on the app domain.
- **Evidence:** `ALLOWED_MIME_TYPES` includes `"image/svg+xml"`. The upload endpoint at `attachments/upload/route.ts` validates MIME type against this allowlist but does not sanitize SVG content.
- **Fix:** Either (a) remove `image/svg+xml` from the allowlist, or (b) sanitize SVG uploads using a library like `DOMPurify` on the server before storing.
- **Effort:** Low (remove from allowlist) to Medium (add sanitization)

### WARNING-4: Search input not escaped for ILIKE wildcards

- **Location:** `artifacts/next-app/src/app/api/notes/route.ts:46`, `artifacts/next-app/src/app/api/quick-bits/route.ts:29`
- **Risk:** The `search` query parameter is interpolated directly into an `ILIKE` pattern: `` `%${search}%` ``. While Drizzle parameterizes values (preventing SQL injection), the ILIKE pattern characters `%` and `_` in user input are not escaped. A user searching for `%` or `_` will get unexpected results. This is a correctness issue rather than a security vulnerability, but the unescaped interpolation pattern looks like it could become a real injection vector if the code changes.
- **Evidence:** `ilike(notesTable.title, \`%${search}%\`)` — the `search` variable comes from query params validated by Zod but not escaped for ILIKE wildcards.
- **Fix:** Escape `%` and `_` in the search string: `search.replace(/%/g, '\\%').replace(/_/g, '\\_')`
- **Effort:** Low

### WARNING-5: Error messages leak internal details

- **Location:** Multiple API routes — `artifacts/next-app/src/app/api/ai/generate/route.ts:339`, `ai/keys/route.ts:43,112,150,182`, `ai/settings/route.ts:52,115`, `ai/usage/route.ts:36`, `ai/models/route.ts:86`
- **Risk:** Catch blocks return `err.message` directly to the client: `{ error: message }`. This can expose internal error messages including database connection strings, file paths, stack frames, or Supabase internal errors.
- **Evidence:** Pattern repeated across all AI routes: `const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });`
- **Fix:** Return a generic error message to the client and log the full error server-side:
  ```typescript
  console.error("[ai/generate] Internal error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  ```
- **Effort:** Low

### WARNING-6: No Next.js middleware for auth protection

- **Location:** `artifacts/next-app/src/` — no `middleware.ts` file exists
- **Risk:** All auth protection is handled per-route in API handlers. If a developer adds a new API route and forgets to call `getAuthUser()`, the route is silently unprotected. Middleware provides defense-in-depth by requiring auth at the routing layer before handlers execute.
- **Evidence:** `Glob` for `middleware.*` in `artifacts/next-app/src/` returns no results.
- **Fix:** Add a `middleware.ts` that validates the auth token for all `/api/*` routes (except `/api/healthz` and `/api/cron/*`). Even if individual route handlers also check auth, middleware catches routes where the check is accidentally omitted.
- **Effort:** Medium

### WARNING-7: Vault PIN verification uses client-side hashing

- **Location:** `artifacts/next-app/src/app/api/vault/setup/route.ts:28`, `vault/unlock/route.ts:28-29`, `vault/change-password/route.ts:27-28`
- **Risk:** The vault password is hashed on the client and the hash is sent to the server. This means: (a) the hashing algorithm and parameters are visible in client-side code, (b) the server stores and compares whatever hash the client sends — if the client hashing is weak (e.g., a single SHA-256 without salt), the stored hashes are vulnerable to rainbow table attacks if the database is breached.
- **Evidence:** The API accepts `passwordHash` from the request body and stores/compares it directly. The hashing implementation lives in client-side code, not server-side.
- **Fix:** Hash the PIN server-side using bcrypt/scrypt/argon2. The client should send the plaintext PIN over HTTPS, and the server should hash it before storage and comparison. This ensures consistent, strong hashing regardless of client implementation.
- **Effort:** Medium

---

## Info Findings (best practice improvements)

### INFO-1: `note_versions` table lacks `userId` column

- **Location:** `lib/db/src/schema/notes.ts:27-42`
- **Risk:** Version ownership can only be determined by joining through the `notes` table on `noteId`. This makes RLS policies more complex and makes the IDOR in CRITICAL-2 easier to overlook.
- **Fix:** Add a `userId` column to `note_versions` and populate it on insert. This enables direct RLS policies and simpler ownership checks.
- **Effort:** Medium (migration + backfill existing rows)

### INFO-2: Auth token cache doesn't invalidate on logout

- **Location:** `artifacts/next-app/src/lib/auth-server.ts:8-34`
- **Risk:** The auth cache (`authCache` Map, 60-second TTL) means that after a user logs out or their session is revoked, API requests with the old token continue to succeed for up to 60 seconds. In a security incident (compromised token), this delays the effect of token revocation.
- **Evidence:** The cache is keyed by the raw token string with a 60-second TTL. There is no mechanism to invalidate a specific token or flush the cache on logout.
- **Fix:** Acceptable for current scale. For production hardening, consider: (a) reducing TTL to 30 seconds, (b) adding a cache invalidation endpoint called during logout, or (c) switching to a shared cache (Redis) that can be flushed.
- **Effort:** Low to Medium

### INFO-3: `storageTier` is user-modifiable without server validation

- **Location:** `lib/db/src/schema/auth.ts:10` — `storageTier` column on `users` table
- **Risk:** If RLS is not enabled (see CRITICAL-1), a user could directly update their own `storage_tier` from "free" to "pro" or "admin" via the Supabase PostgREST API, bypassing upload size and storage limits.
- **Evidence:** The `users` table has a `storage_tier` column defaulting to "free". The application reads this value to enforce upload limits (`attachment-limits.ts`), but nothing prevents a direct DB update.
- **Fix:** This is mitigated if RLS is properly configured with a restrictive UPDATE policy on the `users` table that prevents users from modifying `storage_tier`. Alternatively, move tier lookup to a server-side config or a separate admin-only table.
- **Effort:** Low (addressed by RLS fix)

### INFO-4: OAuth redirect URL uses `window.location.origin`

- **Location:** `artifacts/next-app/src/hooks/use-auth.ts:118`
- **Risk:** The OAuth redirect URL is dynamically constructed from `window.location.origin`. This is fine as long as the Supabase project's allowed redirect URLs are locked down to production and preview domains. If the Supabase config allows wildcards or localhost, an attacker on a different origin could initiate an OAuth flow that redirects the token to their domain.
- **Evidence:** `redirectTo: window.location.origin + "/"` — dynamic, not hardcoded.
- **Fix:** NEEDS MANUAL VERIFICATION — check the Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Ensure only production (`https://graphe.app` or similar) and Vercel preview (`https://*.vercel.app`) domains are listed. Remove `localhost` entries before production launch.
- **Effort:** Low (configuration check)

### INFO-5: Cron endpoint uses bearer token auth only

- **Location:** `artifacts/next-app/src/app/api/cron/purge-deleted/route.ts:9-11`
- **Risk:** The cron purge endpoint is protected only by `CRON_SECRET`. If this secret leaks, anyone can trigger bulk deletion of notes and attachments. There's no IP allowlisting or additional verification.
- **Evidence:** `if (authHeader !== \`Bearer ${process.env.CRON_SECRET}\`) { return 401 }`
- **Fix:** Acceptable if using Vercel Cron (which sets the secret automatically). Verify that `CRON_SECRET` is a strong random value (32+ bytes). Consider adding IP allowlisting for Vercel's cron IPs as defense-in-depth.
- **Effort:** Low

### INFO-6: 14 npm audit vulnerabilities (9 moderate, 4 high, 1 critical)

- **Location:** Various transitive dependencies
- **Risk:** Most are in transitive dependencies (posthog-js → protobufjs, orval → picomatch, sentry → uuid) and are low practical risk in this context. The drizzle-orm vulnerability is addressed in CRITICAL-3.
- **Evidence:** `pnpm audit` output shows:
  - 1 critical: protobufjs < 7.5.5 (arbitrary code execution — via posthog-js, low practical risk as it's a serialization lib)
  - 4 high: picomatch ReDoS (2 instances, dev/build-time only), drizzle-orm SQL injection (addressed above), cross-spawn ReDoS
  - 9 moderate: various (uuid, cross-spawn)
- **Fix:** Run `pnpm update` to pick up patched transitive versions. For pinned transitive deps, add `pnpm.overrides` in root `package.json`.
- **Effort:** Low

---

## Audit Coverage Summary

| Area | What Was Checked | Files/Routes Reviewed | Issues Found |
| --- | --- | --- | --- |
| 1. RLS | All Drizzle schema files, migration SQL, grep for RLS/policy | 10 schema files, 1 migration | CRITICAL-1: No RLS anywhere |
| 2. API Route Auth | Every `route.ts` in `src/app/api/` | 37 route files, all HTTP methods | CRITICAL-2: Versions IDOR |
| 3. Input Validation | Zod usage, raw SQL, ILIKE patterns | All 37 routes | WARNING-4: ILIKE unescaped |
| 4. Rate Limiting | Grep for rate limit/throttle | Full codebase | WARNING-2: No rate limiting on vault |
| 5. Secrets/Key Mgmt | Env var usage, encryption.ts, .gitignore, git history | All server-side files | Clean — secrets properly scoped |
| 6. Demo Mode | Demo context, page.tsx, store.ts | 21 files referencing demo | Clean — fully client-side |
| 7. Error Handling | Catch blocks in all API routes | All 37 routes | WARNING-5: err.message leaked |
| 8. Auth Flows | use-auth.ts, supabase.ts, supabase-admin.ts, auth-server.ts | 4 auth files | WARNING-7: Client-side vault hashing; INFO-2, INFO-4 |
| 9. Storage Security | attachment-limits.ts, upload route, MIME types | 5 attachment files | WARNING-3: SVG XSS |
| 10. Dependencies | pnpm audit | Full dependency tree | CRITICAL-3: drizzle-orm CVE; INFO-6: 14 total vulns |
| 11. Middleware/Headers | next.config.ts, middleware check, headers | 2 config files | WARNING-1: No headers; WARNING-6: No middleware |
| 12. Client Data | store.ts, localStorage/sessionStorage grep, demo-data.ts | 15+ client files | Clean — no server secrets in client |

---

## Route-by-Route Auth Matrix

| Route | Method | Auth Required | Auth Implemented | Zod Validation | Rate Limited |
| --- | --- | --- | --- | --- | --- |
| /api/healthz | GET | No | N/A (intentional) | Yes (response) | No |
| /api/cron/purge-deleted | GET | Yes (CRON_SECRET) | Yes (bearer token) | No | No |
| /api/folders | GET | Yes | Yes | Yes (response) | No |
| /api/folders | POST | Yes | Yes | Yes | No |
| /api/folders/:id | PATCH | Yes | Yes | Yes | No |
| /api/folders/:id | DELETE | Yes | Yes | Yes | No |
| /api/notes | GET | Yes | Yes | Yes | No |
| /api/notes | POST | Yes | Yes | Yes | No |
| /api/notes/:id | GET | Yes | Yes | Yes | No |
| /api/notes/:id | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id | DELETE | Yes | Yes | Yes | No |
| /api/notes/:id/pin | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id/favorite | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id/move | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id/vault | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id/delete | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id/restore | PATCH | Yes | Yes | Yes | No |
| /api/notes/:id/permanent | DELETE | Yes | Yes | Yes | No |
| /api/notes/:id/versions | GET | Yes | Yes (token only) | No (manual Number) | No |
| /api/notes/:id/versions | POST | Yes | Yes (token only) | No (manual parse) | No |
| /api/notes/:id/versions/:vid | GET | Yes | Yes (token only) | No (manual Number) | No |
| /api/notes/:id/versions/:vid | PATCH | Yes | Yes (token only) | No (manual parse) | No |
| /api/notes/:id/versions/:vid | DELETE | Yes | Yes (token only) | No (manual Number) | No |
| /api/notes/:id/versions/:vid/restore | POST | Yes | Yes (**with userId**) | No (manual Number) | No |
| /api/tags | GET | Yes | Yes | Yes (response) | No |
| /api/vault/status | GET | Yes | Yes | Yes | No |
| /api/vault/setup | POST | Yes | Yes | Yes | No |
| /api/vault/unlock | POST | Yes | Yes | Yes | **No (NEEDS IT)** |
| /api/vault/change-password | POST | Yes | Yes | Yes | **No (NEEDS IT)** |
| /api/quick-bits | GET | Yes | Yes | Yes | No |
| /api/quick-bits | POST | Yes | Yes | Yes | No |
| /api/quick-bits/:id | GET | Yes | Yes | Yes | No |
| /api/quick-bits/:id | PATCH | Yes | Yes | Yes | No |
| /api/quick-bits/:id | DELETE | Yes | Yes | Yes | No |
| /api/quick-bits/:id/soft-delete | DELETE | Yes | Yes | Yes (Zod) | No |
| /api/quick-bits/settings | GET | Yes | Yes | Yes | No |
| /api/quick-bits/settings | PATCH | Yes | Yes | Yes | No |
| /api/quick-bits/expired | DELETE | Yes | Yes | No | No |
| /api/smart-folders | GET | Yes | Yes | Yes | No |
| /api/smart-folders | POST | Yes | Yes | Yes | No |
| /api/smart-folders/:id | PATCH | Yes | Yes | Yes | No |
| /api/smart-folders/:id | DELETE | Yes | Yes | Yes | No |
| /api/ai/generate | POST | Yes | Yes | Manual validation | Yes (free tier) |
| /api/ai/keys | GET | Yes | Yes | No (manual) | No |
| /api/ai/keys | POST | Yes | Yes | No (manual) | No |
| /api/ai/keys | PATCH | Yes | Yes | No (manual) | No |
| /api/ai/keys | DELETE | Yes | Yes | No (manual) | No |
| /api/ai/settings | GET | Yes | Yes | No (manual) | No |
| /api/ai/settings | PATCH | Yes | Yes | No (manual) | No |
| /api/ai/usage | GET | Yes | Yes | No | No |
| /api/ai/models | POST | Yes | Yes | No (manual) | No |
| /api/attachments/upload | POST | Yes | Yes | Manual validation | No |
| /api/attachments/:id | DELETE | Yes | Yes | Manual validation | No |
| /api/attachments/note/:noteId | GET | Yes | Yes | Manual validation | No |
| /api/attachments/all | GET | Yes | Yes | No | No |

**Notes on "Auth Implemented":**
- "Yes" = calls `getAuthUser()`, returns 401 if null, AND scopes DB queries by `userId`
- "Yes (token only)" = calls `getAuthUser()` and returns 401, but **does NOT scope queries by userId** (IDOR vulnerability — CRITICAL-2)
- All note version endpoints except `/restore` have the IDOR issue

---

## RLS Policy Matrix

| Table | RLS Enabled | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| users | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | No RLS in migrations; may be configured in Supabase Dashboard |
| notes | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Same — check Dashboard |
| note_versions | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | No `user_id` column; policy would need JOIN through `notes` |
| folders | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` column |
| vault_settings | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` column |
| quick_bits | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` column |
| quick_bit_settings | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` column |
| smart_folders | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` column |
| user_api_keys | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` FK to auth.users |
| user_settings | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | `user_id` is PK, FK to auth.users |
| ai_usage | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` FK to auth.users |
| attachments | **NEEDS VERIFICATION** | Unknown | Unknown | Unknown | Unknown | Has `user_id` column |

**Action required:** Check the Supabase Dashboard for each table. If RLS is not enabled, this is the highest-priority fix.

---

## Recommended Fix Priority

### Session 1: Critical security fixes (estimated: 2-3 hours)

1. **CRITICAL-3** — Update drizzle-orm to >= 0.45.2 (10 min)
2. **CRITICAL-2** — Add userId ownership checks to all note version endpoints (30 min)
3. **CRITICAL-1** — Verify RLS status in Supabase Dashboard; if not enabled, add RLS policies to all tables (1-2 hours)
4. **WARNING-3** — Remove `image/svg+xml` from ALLOWED_MIME_TYPES (5 min)

### Session 2: Security hardening (estimated: 2-3 hours)

5. **WARNING-1** — Add security headers to next.config.ts (30 min including CSP testing)
6. **WARNING-5** — Replace err.message leaks with generic errors in all AI routes (20 min)
7. **WARNING-2** — Add rate limiting to vault unlock/change-password (1 hour)
8. **WARNING-4** — Escape ILIKE wildcards in search (10 min)

### Session 3: Defense-in-depth (estimated: 2-3 hours)

9. **WARNING-6** — Add Next.js auth middleware for /api/* routes (1 hour)
10. **WARNING-7** — Move vault PIN hashing to server-side (1-2 hours, breaking change)
11. **INFO-1** — Add userId column to note_versions table (1 hour including migration)
12. **INFO-6** — Run `pnpm update` and add overrides for transitive vulnerabilities (30 min)

### Manual verification checklist

- [ ] Check Supabase Dashboard → each table's RLS status and policies
- [ ] Check Supabase Dashboard → Authentication → Redirect URLs (remove localhost, verify domains)
- [ ] Check Supabase Dashboard → Storage → note-attachments bucket → policies
- [ ] Verify CRON_SECRET is a strong random value (32+ bytes)
- [ ] Check Sentry configuration — ensure breadcrumbs don't capture sensitive data (vault PINs, API keys)
- [ ] Check PostHog event properties — ensure no PII beyond userId/email in capture calls
