# Graphe Notes — Claude Code Guide

## Deployment Status
Migration to Next.js 15 App Router is complete. The app lives in `artifacts/next-app`
and is deployed on Vercel from the `migration/next.js` branch.

---

## Session Startup
At the start of every new session, before doing anything else:
1. Pull the latest `migration/next.js` from GitHub into the local main repo
2. Check that `.env` exists in the main repo root — if not, copy `.env.example` to `.env`
   and inform the user that placeholder values are in place (real credentials from
   1Password are needed for full login/DB access)
3. Run `pnpm install` from the repo root
4. Start the `next-app` preview server (port 3000)
Do this automatically without being asked.

**Do not start the old `notes-app` (port 5173) or `api-server` (port 3001) servers.**

---

## Common Commands

```bash
# Dev server (Next.js, port 3000)
pnpm --filter @workspace/next-app run dev

# Typecheck — run from repo root
pnpm run typecheck

# Push DB schema changes
pnpm --filter @workspace/db run push

# Regenerate API hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

---

## Adding Packages

- Use `pnpm add` with `--filter` targeting the correct workspace package:
  ```bash
  pnpm add some-package --filter @workspace/next-app
  ```
- For packages shared across multiple workspaces, add to the `catalog:` section of
  `pnpm-workspace.yaml` and reference it as `"catalog:"` in each `package.json`.

---

## Post-Merge Hook

A git post-merge hook lives at `scripts/post-merge.sh`. It runs automatically after
every `git merge` or `git pull` and does two things:
1. `pnpm install --frozen-lockfile` — installs any new or updated dependencies
2. `pnpm --filter db push` — applies any pending DB schema changes

Do not skip or manually replicate these steps after a merge. Let the hook handle them.

---

## Path Alias

- `artifacts/next-app` uses `@/` as an alias for `src/`.
  Use `@/components/...`, `@/hooks/...`, `@/lib/...`, etc. in all imports.

---

## Tailwind CSS

- Version 4 via `@tailwindcss/postcss` (PostCSS integration — not Vite).
- Global styles live in `artifacts/next-app/src/app/globals.css`.
- Use `@import "tailwindcss";` at the top of CSS files. No separate `tailwind.config.*`
  is needed unless customizing the theme.

---

## Environment Variables

All env vars are injected at build/runtime — no `.env` files are committed.

| Variable | Required by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | frontend | Client-safe Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | Client-safe public anon key |
| `SUPABASE_URL` | backend | Supabase project URL (server routes) |
| `SUPABASE_ANON_KEY` | backend | Fallback — used by next.config.ts to populate NEXT_PUBLIC_ |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only | Admin operations — **never expose to frontend** |
| `SUPABASE_DB_URL` | `lib/db` (Drizzle) | Session-mode pooler connection string |

For local dev, the repo-root `.env` is loaded automatically by `next.config.ts`.
See `artifacts/next-app/.env.example` for the full list of variables to set.

---

## Vercel Deployment

`vercel.json` at the repo root configures Vercel to build from the monorepo subdirectory:

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm --filter @workspace/next-app run build",
  "outputDirectory": "artifacts/next-app/.next",
  "installCommand": "pnpm install"
}
```

**Required environment variables** — set these in Vercel → Project Settings → Environment Variables:

| Variable | Scope |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All (client + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All (client + server) |
| `SUPABASE_URL` | Server only |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `SUPABASE_DB_URL` | Build only (DB migrations) |

**Branch strategy:**
- `migration/next.js` → production deployment
- `feature/*` and `fix/*` branches → Vercel preview deployments

---

## Codebase Caveats

**No tests exist.** There is no test runner configured. Do not suggest or scaffold tests
unless explicitly asked.

**AI provider keys** (OpenAI, Anthropic, Gemini) are stored in **plaintext
`localStorage`**. This is intentional for the current phase where users supply their own
keys.

---

## Working Convention

- Before running any terminal command, explain in plain English what it does, why it is
  necessary, what it affects, and whether it is reversible. Wait for confirmation.
- Only modify code files within the Graphe-Notes repository. Installing packages and
  running dev tools is fine. Never modify unrelated projects or system configuration
  files.
- Never delete files without explicitly telling me what you are deleting and why. Wait
  for confirmation.
- Never commit directly to master. Always use a feature branch.
- When something goes wrong, stop immediately and explain what happened before attempting
  a fix.

---

## Worktree Architecture (Claude Code)

This repo uses a Claude Code git worktree to power the local preview server. The
worktree branch name is **randomized each session** (e.g. `claude/modest-albattani`) —
do not rely on it by name. The worktree is always created from `migration/next.js`.

| Branch | Purpose |
|---|---|
| `migration/next.js` | Active branch — base for all new work |
| `feature/<name>` | New feature work, branched from `migration/next.js`, pushed to GitHub |
| `fix/<description>` | Bug fixes, branched from `migration/next.js`, pushed to GitHub |
| `claude/<random-name>` (worktree) | Powers the local preview server only |

**PR workflow:**
1. Create `feature/<name>` or `fix/<name>` from `migration/next.js` in the main repo
2. Make all commits on that branch — never on the `claude/*` worktree branch
3. Push and open PR targeting `migration/next.js` (not master)

The `claude/*` worktree branch exists only to power the local preview server. It is
never pushed or used as a PR source.
