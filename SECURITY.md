# Security

Reference for the Graphe Notes security model. Read this before adding new endpoints, database tables, or anything touching authentication, data access, or user credentials.

---

## Security Model Overview

Graphe Notes uses a defense-in-depth approach with multiple independent security layers:

1. **JWT middleware** — validates all `/api/*` requests at the module boundary before any handler code runs
2. **Per-route auth** — each handler independently extracts and validates the authenticated user
3. **Service-role DB access** — route handlers use the Supabase service role key which bypasses RLS; the route handler is the primary authorization gate
4. **Row Level Security** — all 13 Supabase tables have RLS enabled with policies that restrict direct PostgREST access to the owning user

No component of this system is intended to be the sole security boundary — the goal is that a bypass of any single layer still fails at the next.

---

## Authentication

### Layer 1: JWT middleware

`artifacts/next-app/src/middleware.ts` intercepts all requests to `/api/*` paths before they reach any handler.

- Uses `jose` library with `createRemoteJWKSet` to validate JWT signatures against Supabase's JWKS endpoint
- An invalid or missing JWT returns 401 immediately, before any handler code executes
- **Exemptions:**
  - `/api/healthz` — no auth required (health check)
  - `/api/cron/*` — uses `CRON_SECRET` header instead (validated inside the handler)

### Layer 2: Per-route user resolution

`artifacts/next-app/src/lib/auth-server.ts` is called inside every handler via `getAuthUser(request)`:

1. Extracts Bearer token from `Authorization: Bearer <token>` header
2. Checks 60-second LRU cache (max 100 entries) — cache key is the token itself
3. On cache miss: calls `supabaseAdmin.auth.getUser(token)` via the Supabase Admin API
4. On success: fires an upsert of the user into the `users` table (fire-and-forget); caches result
5. Returns `{ user }` — handlers use `user.id` for all DB queries

**Token invalidation latency:** Up to 60 seconds. A revoked Supabase session token can still authenticate for up to one cache TTL cycle.

### What every handler must do

```typescript
const { user } = await getAuthUser(request);
if (!user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
const userId = user.id; // Use this for ALL db queries — never trust client-provided IDs
```

Never use a user ID from the request body or query params. The authenticated `user.id` is the only trusted source.

---

## Row Level Security

All 13 tables have RLS enabled. Policies restrict direct PostgREST access (if it were ever enabled) to the owning user.

### Policy pattern

Standard pattern applied to most tables:

```sql
-- SELECT: own rows only
CREATE POLICY "table_select" ON public.table_name
  FOR SELECT USING (user_id = auth.uid()::text);

-- INSERT: own rows only
CREATE POLICY "table_insert" ON public.table_name
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- UPDATE: own rows only
CREATE POLICY "table_update" ON public.table_name
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- DELETE: own rows only
CREATE POLICY "table_delete" ON public.table_name
  FOR DELETE USING (user_id = auth.uid()::text);
```

### Special cases

**`templates`** — SELECT policy allows reading preset rows across users: `user_id = auth.uid()::text OR is_preset = true`. This allows the template picker to show global preset templates while still restricting access to other users' custom templates.

**`note_versions`** — has a denormalized `user_id varchar NOT NULL` column backfilled from `notes.user_id`. Policies use a direct equality check (same pattern as other tables). The index `note_versions_user_id_idx` keeps RLS scans fast.

**`users`** — the UPDATE policy restricts `storage_tier` changes:

```sql
USING (id = auth.uid()::text)
WITH CHECK (id = auth.uid()::text AND storage_tier = (SELECT storage_tier FROM public.users WHERE id = auth.uid()::text))
```

This prevents a user from self-promoting their storage tier via a direct PostgREST PATCH.

### Migrations

- `lib/db/drizzle/0001_enable_rls_all_tables.sql` — RLS + policies for 12 tables
- `lib/db/drizzle/0002_note_versions_user_id.sql` — adds denormalized `user_id` to `note_versions`, replaces JOIN-based policies with direct column check
- `lib/db/drizzle/0003_templates_rls_policies.sql` — RLS + policies for `templates` table

### Adding new tables

When adding a new table:
1. Add RLS enable + all four CRUD policies in the Drizzle migration file
2. Verify policies in the Supabase dashboard before merging
3. Document the table in ARCHITECTURE.md

---

## Vault Security

Notes can be vaulted (locked) and require a PIN to access.

### PIN hashing

- Stored as bcrypt with 12 salt rounds (OWASP recommended minimum)
- 12 rounds: ~300ms on modern hardware — sufficient to make offline brute force expensive

### Legacy migration

Older vault PINs were stored as SHA-256 (client-side, single-pass). On first successful PIN entry, `verifyPin()` in `lib/vault-hash.ts` detects the hash format and transparently migrates:

1. Detect legacy hash: `isBcryptHash(hash)` checks for `$2a$` / `$2b$` prefix
2. On legacy match: verify with SHA-256, then rehash with bcrypt and write the new hash
3. On next PIN entry: bcrypt is used

This migration is transparent to the user.

### Rate limiting

Vault operations are rate-limited via an in-memory sliding window (`src/lib/rate-limit.ts`):

- **Unlock**: 5 attempts per 15-minute window per user
- **Setup / change**: 3 attempts per 1-hour window per user

**Known limitation:** The rate limiter uses a Node.js `Map` in module scope. In a serverless (Vercel) deployment, each function instance maintains its own rate limit state. An attacker with access to many concurrent instances could get 5 attempts per instance rather than 5 globally. Auth validation is still required, so this does not enable PIN-less access. The global AI rate limiter (db-tracked) does not share this limitation.

---

## AI Key Encryption

User-provided AI provider keys (OpenAI, Anthropic, Google AI Studio) are encrypted before being stored in the database.

### Implementation (`lib/encryption.ts`)

- Algorithm: AES-256-GCM
- Key: 32-byte hex string from `AI_KEY_ENCRYPTION_SECRET` environment variable
- IV: 12 random bytes generated per encryption with `crypto.randomBytes(12)`
- Auth tag: 16-byte GCM auth tag verified on decrypt (tamper detection)
- Storage format: `base64(hex(iv) + ":" + hex(authTag) + ":" + hex(ciphertext))`

### Key handling rules

- Keys are decrypted only on the server, only in the `/api/ai/generate` handler
- Decrypted keys are never returned to the client
- Decrypted keys are never logged
- The encryption secret is a server-only environment variable — never in client-side code

---

## Rate Limiting

Two rate limiting systems with different backends:

| System | Backend | Scope | Limits |
|---|---|---|---|
| AI free tier | Database (`ai_usage` table) | Per user (hourly) + global (monthly) | 5 req/hour per user; 100k req/month global |
| Vault operations | In-memory Map | Per user, per instance | 5/15min (unlock); 3/1hr (setup) |

The AI rate limiter is DB-backed and survives serverless restarts and scales across instances. The vault rate limiter does not — see the Known Limitation note above.

---

## Input Validation

### Request bodies and query params

All request parameters are validated with Zod schemas from `@workspace/api-zod` (generated from the OpenAPI spec). Validation happens at the handler boundary — invalid inputs return `400` before any DB query runs.

### Database queries

All queries use Drizzle ORM's parameterized query interface. Drizzle does not concatenate user input into SQL strings.

**Exception — LIKE search:** The notes search endpoint builds a `LIKE` query with user-supplied input. The search term has SQL wildcards (`%`) escaped before being interpolated. Verify this escape is in place before modifying the search handler.

### Content

HTML content from the Tiptap editor is stored as-is in the `content` column. It is rendered inside the Tiptap ProseMirror instance, which handles sanitization. If content is ever rendered outside ProseMirror (e.g. in an email or PDF export), sanitize it first with DOMPurify or equivalent.

---

## Security Headers

Set in `artifacts/next-app/next.config.ts` on all routes:

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | Restrictive allowlist | Limits injection attack surface |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `Permissions-Policy` | Restrictive | Disables unused browser features |

When adding integrations with new external domains (CDNs, APIs, fonts), update the CSP `connect-src` and relevant other directives in `next.config.ts`.

---

## Demo Mode Isolation

Demo mode (`DemoContext`) runs inside the authenticated app shell but makes no calls to authenticated API endpoints.

- `isDemoMode()` is a React context value — it cannot be spoofed by URL parameters or localStorage
- Demo mutations patch the React Query cache directly — they never reach the API
- Demo vault PIN is in `sessionStorage` only — it is not in the database
- Demo data is static in `src/lib/demo-data.ts` — no user data is ever involved

Demo mode is safe to run without any backend credentials. CI uses demo mode exclusively.

---

## Security Checklist for New Code

Before opening a PR that adds endpoints, tables, or authentication changes:

- [ ] Every API route calls `getAuthUser()` and returns 401 if `user` is null
- [ ] All DB queries are scoped to `userId` — no query that could return another user's data
- [ ] New tables have RLS enabled with CRUD policies in the migration file
- [ ] RLS policies verified in the Supabase dashboard (not just the migration file)
- [ ] No client-provided user ID is trusted — only `user.id` from `getAuthUser()`
- [ ] No AI provider keys are returned to the client or logged server-side (exception: local LLM key — see below)
- [ ] Rate limiting is in place for any endpoint that calls an external paid API
- [ ] New external domains are added to the CSP `connect-src` directive
- [ ] No secrets committed to the repo; `.env.example` uses placeholder names only
- [ ] Sentry `captureException` is in every catch block that handles a failure surface
- [ ] `SECURITY.md` is updated with any new resolved issues or pattern changes

---

## Resolved Issues

**SHA-256 vault PIN storage**
Vault PINs were originally stored as a single-round SHA-256 hash (client-side). This was insufficient against offline brute force. Resolved by migrating to server-side bcrypt with 12 salt rounds. A transparent migration path converts legacy hashes on first successful PIN entry. The `isBcryptHash()` helper in `lib/vault-hash.ts` detects the hash format.

**Templates table: missing RLS policies**
The `templates` table had RLS enabled (from migration 0001) but no CREATE POLICY statements. This meant direct PostgREST access with the anon key could read any user's custom templates. Resolved in migration `0003_templates_rls_policies.sql` with full CRUD policies scoped to `user_id = auth.uid()::text`. SELECT policy also permits preset templates (`is_preset = true`) to remain globally readable.

**Missing Sentry instrumentation in ai/generate**
The `/api/ai/generate` catch block only logged to `console.error`. Server errors were invisible in the Sentry dashboard. Resolved by adding `Sentry.captureException(err)` to the catch block in `artifacts/next-app/src/app/api/ai/generate/route.ts`.

**Template DELETE missing userId filter**
The `DELETE /api/templates/:id` handler verified template ownership via a SELECT query but then issued the DELETE with only `eq(templatesTable.id, id)` — no `userId` constraint. While the preceding SELECT prevented cross-user access in practice, the DELETE itself was unscoped. Resolved by adding `eq(templatesTable.userId, user.id)` to the DELETE WHERE clause, matching the defense-in-depth pattern used by every other DELETE route.

**`rls_auto_enable` SECURITY DEFINER function callable via PostgREST RPC**
The `public.rls_auto_enable()` function (an event trigger that auto-enables RLS on new tables) was callable by `anon` and `authenticated` roles via `/rest/v1/rpc/rls_auto_enable`. While the function only enables RLS (not destructive), exposing a SECURITY DEFINER function to unauthenticated callers violates least-privilege. Resolved in migration `0005_revoke_rls_auto_enable.sql` by revoking EXECUTE from `anon` and `authenticated`. The event trigger itself is unaffected.

**Master branch had no required CI checks**
The `master` branch protection allowed merges to proceed even with failing CI. Resolved by adding `Typecheck` and `E2E Tests` as required status checks (via GitHub branch protection API). PRs cannot now be merged until both pass. `enforce_admins` remains `false` so the repo owner can still bypass in emergencies.

---

## Documented Exceptions

**Local LLM API key returned to client**
`GET /api/ai/settings` decrypts and returns the local LLM API key when the active provider is `local_llm`. This is an intentional exception to the "decrypted keys are never returned to the client" rule. The browser must send the key directly to the user's local LLM server (which the backend cannot reach). The key is only returned to the authenticated user who stored it.

---

## Known Limitations

**Leaked password protection (requires paid Supabase plan)**
Supabase Auth can check new passwords against HaveIBeenPwned to prevent users from signing up with known-compromised passwords. This feature requires a paid Supabase plan and is not currently enabled. If the project upgrades to a paid plan, enable this in Supabase Dashboard → Authentication → Providers → Email → Leaked Password Protection.

**CSP uses `unsafe-inline` and `unsafe-eval` in `script-src`**
The Content Security Policy includes `unsafe-inline` and `unsafe-eval` in the `script-src` directive. This is a known trade-off with Next.js: `unsafe-inline` is required for Next.js inline scripts, and `unsafe-eval` is required by PostHog and some Next.js internals. Removing these would break the application. This can be improved in the future with nonce-based CSP using `next/headers` strict CSP support.

---

## Manual Action Required

**Resolve Sentry dev-build noise**
As of the May 2026 security audit, there are 15 unresolved errors in Sentry, all from dev builds (hydration errors, Framer Motion keyframe warnings, build-time CSS/component errors). None are security-relevant, but they clutter the dashboard and could mask real production errors. Steps:
1. Go to the Sentry dashboard → Issues
2. Filter by project `javascript-nextjs`
3. Select all unresolved dev-build issues (hydration, motion keyframe, build errors)
4. Bulk-resolve them
5. Consider adding `ignoreErrors` patterns to `sentry.client.config.ts` for known dev-only noise like hydration mismatches

**Enable GitHub-native security features (free for public repos)**
This repo is intentionally public (used as a portfolio for job applications). GitHub provides three free security features that should be enabled:

1. **Secret scanning + push protection** — detects leaked tokens in commits and blocks pushes that contain known secret patterns
   - Settings → Code security → Secret protection → Enable both "Secret scanning" and "Push protection"

2. **Dependabot alerts + security updates** — flags vulnerable npm dependencies and auto-opens PRs to upgrade them
   - Settings → Code security → Dependabot → Enable "Dependabot alerts" and "Dependabot security updates"

3. **CodeQL default setup** — static analysis for SQL injection, XSS, hardcoded secrets, and other common vulnerabilities
   - Settings → Code security → Code scanning → Set up → Default

All three are zero-config, no infrastructure needed, and free for public repos.

**Optional: clean up stale branch**
The remote branch `fix/ipad-touch-cursor-input` has 12 unmerged commits dating back to early in the project. No secrets in the diff, but branches accumulating on a public repo are visible. Either open a PR to merge the work or delete the branch:
```bash
git push origin --delete fix/ipad-touch-cursor-input
```

---

## Full Audit History

**May 2026 — Full-stack security audit**
Scope: all 39 API route handlers, middleware, auth-server, rate-limit, encryption, vault hashing, CSP/security headers, Supabase RLS (live-verified on all 13 tables and 52 policies), Supabase security advisors, storage bucket policies, Sentry error dashboard, PostHog event properties, and Vercel configuration. 16 attack scenarios tested. Findings: 2 code-level fixes (template DELETE, rls_auto_enable RPC), 1 documentation exception (local LLM key), 1 known limitation (leaked password protection), 1 housekeeping item (Sentry noise). No critical or high-severity vulnerabilities found.

**May 2026 — GitHub-side security audit**
Follow-up audit covering the GitHub repository itself: visibility, branch protection, commit history, secrets, workflows, branches, PRs, and issues. Scope was 420 commits across all branches grep'd for common secret patterns (JWT, OpenAI/Anthropic keys, GitHub tokens, Google API keys, PEM private keys) — zero hits. `.env*` properly gitignored throughout. Repo is intentionally public for portfolio purposes. Findings: 1 code change (added required CI status checks to master via branch protection API), 1 doc-only change (strengthened the placeholder-secret warning comment in `.github/workflows/e2e.yml`), 3 manual dashboard actions (enable secret scanning, Dependabot alerts, CodeQL — all free for public repos). Solo-developer trade-offs intentionally not changed: required PR reviewers stays at 0 (would block self-merge), required signed commits stays off (would block unsigned commits), stale `fix/ipad-touch-cursor-input` branch not deleted (may contain WIP).
