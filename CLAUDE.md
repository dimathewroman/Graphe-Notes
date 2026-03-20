# Graphe Notes — Claude Code Guide

> For full stack/architecture details see `replit.md`. This file covers what Claude Code needs to work effectively in this repo.

## Current Sprint
NOW: Next.js 15 migration — rebuilding Graphe Notes on the App Router.
Active branch: `migration/next.js` · App location: `artifacts/next-app`

---

## Session Startup
At the start of every new session, before doing anything else:
1. Pull the latest `migration/next.js` from GitHub into the local main repo
2. Create a new worktree branching from that updated `migration/next.js`
3. Check that `.env` exists in the main repo root — if not, copy `.env.example` to `.env`
   and inform the user that placeholder values are in place (real credentials from
   1Password are needed for full login/DB access)
4. Run `pnpm install` from the worktree root
5. Start the `next-app` preview server (port 3000)
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
| `SUPABASE_URL` | frontend + backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | frontend + backend | Public anon key, safe for client |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only | Admin operations — **never expose to frontend** |
| `SUPABASE_DB_URL` | `lib/db` (Drizzle) | Session-mode pooler connection string |

---

## Codebase Caveats

**No tests exist.** There is no test runner configured. Do not suggest or scaffold tests
unless explicitly asked.

**Auth is not yet wired up.** `@workspace/replit-auth-web` is not used in `next-app`.
Auth will be rebuilt separately. Do not reference or import it.

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
| `migration/next.js` | Active migration work — base for all new branches |
| `feature/<name>` | New feature work, branched from `migration/next.js`, pushed to GitHub |
| `fix/<description>` | Bug fixes, branched from `migration/next.js`, pushed to GitHub |
| `claude/<random-name>` (worktree) | Powers the local preview server only |

**PR workflow:**
1. Create `feature/<name>` or `fix/<name>` from `migration/next.js` in the main repo
2. Make all commits on that branch — never on the `claude/*` worktree branch
3. Push and open PR targeting `migration/next.js` (not master)

The `claude/*` worktree branch exists only to power the local preview server. It is
never pushed or used as a PR source.
