# Graphe Notes — Claude Code Guide

> For full stack/architecture details see `replit.md`. This file covers what Claude Code needs to work effectively in this repo.

## Current Sprint
NOW: Core Gaps + Quick Bits + Built-in Gemini Free Tier
See ROADMAP.md for full feature breakdown and status.

Recently shipped: Custom gradient color picker, font picker, font size control,
sidebar restructure, toolbar popover bug fixes, load-env CJS crash fix.

---

## Session Startup
At the start of every new session, before doing anything else:
1. Pull the latest master from GitHub into the local main repo
2. Create a new worktree branching from that updated local master
3. Check that `.env` exists in the main repo root — if not, copy `.env.example` to `.env`
   and inform the user that placeholder values are in place (demo mode will work, but
   real credentials from 1Password are needed for full login/DB access)
4. Run `pnpm install` from the worktree root
5. Start both preview servers: `notes-app` (port 5173) and `api-server` (port 3001)
Do this automatically without being asked.

---

## Common Commands

```bash
# Dev server (frontend, port 5173)
pnpm --filter @workspace/notes-app run dev

# Typecheck — always run from repo root (composite project references require it)
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
  pnpm add some-package --filter @workspace/notes-app
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

## API Client Pattern

- **Never write raw fetch calls.** All API calls go through generated React Query hooks
  in `@workspace/api-client-react`.
- To add a new endpoint:
  1. Edit `lib/api-spec/openapi.yaml`
  2. Run `pnpm --filter @workspace/api-spec run codegen`
  3. Import and use the generated hook
- Query cache keys are exported alongside hooks: `getGetNotesQueryKey()`,
  `getGetNoteQueryKey(id)`, etc.

---

## Demo Mode Pattern

- `useDemoMode()` returns `isDemo: boolean`. Import from the demo context.
- In demo mode, **patch the React Query cache directly** instead of calling API mutations:
  ```tsx
  queryClient.setQueryData(getGetNoteQueryKey(id), { ...existing, vaulted: true });
  ```
- **Demo vault PIN** is stored in `sessionStorage` under the key `"demo_vault_hash"`.
  Always use sessionStorage as the source of truth for whether a PIN is configured in
  demo mode — the React Query vault status cache (`["/api/vault/status"]`) may refetch
  and clear.

---

## State Management

| Concern | Where |
|---|---|
| Selected note, active filter, sidebar/note-list visibility, vault unlock | Zustand — `artifacts/notes-app/src/store.ts` |
| Server data (notes, folders, tags, vault status) | React Query (TanStack Query v5) |

---

## Responsive Breakpoints

- `useBreakpoint()` from `src/hooks/use-mobile.tsx` → `"mobile" | "tablet" | "desktop"`
- Mobile < 768px · Tablet 768–1023px · Desktop 1024px+
- Mobile is single-column (no persistent panels). Always ensure a back navigation button
  exists on every mobile screen, including edge cases like vault-locked notes.

---

## Toolbar Popover Pattern

All toolbar menus (color picker, word count, font picker, font size, link popover) must
use this pattern:

- Render via `ReactDOM.createPortal` targeting `document.body` to escape
  `overflow: hidden` on `ScrollableToolbar`
- Position using `getBoundingClientRect()` on the trigger button
- Clamp to viewport with at least 8px padding on all edges so menus never overflow
  off-screen
- Use `z-50`
- Close on outside click and Escape key

Never render toolbar dropdowns as direct children of the toolbar — they will be clipped.

---

## Path Alias

- The frontend uses `@/` as an alias for `src/`. Use `@/components/...`, `@/hooks/...`,
  `@/lib/...`, etc. in all imports within `artifacts/notes-app`.

---

## Environment Variables

All env vars are injected at build/runtime — no `.env` files are committed.

| Variable | Required by | Notes |
|---|---|---|
| `SUPABASE_URL` | frontend + backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | frontend + backend | Public anon key, safe for client |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only | Admin operations — **never expose to frontend** |
| `SUPABASE_DB_URL` | `lib/db` (Drizzle) | Session-mode pooler connection string |
| `PORT` | frontend (Vite) | Dev server port |
| `BASE_PATH` | frontend (Vite) | URL base path |

---

## Codebase Caveats

**No tests exist.** There is no test runner configured (no Vitest, Jest, or testing
library). Do not suggest or scaffold tests unless explicitly asked.

**`NoteEditor.tsx` is very large.** It is the biggest file in the repo and growing. Be
surgical — read only the relevant section before editing. Never rewrite or reorganize
sections you are not directly changing.

**Toolbar menus are portaled.** `ColorPickerDropdown`, `WordCountPopover`, font picker,
and font size dropdowns all render via React portals. See Toolbar Popover Pattern above.

**FontSize is not a separate package.** It is a named export from
`@tiptap/extension-text-style`, which is already installed. Import it as:
`import { FontSize } from "@tiptap/extension-text-style"`.
Do not install `@tiptap/extension-font-size` — it is deprecated.

**AI provider keys** (OpenAI, Anthropic, Gemini) are stored in **plaintext
`localStorage`**. This is intentional for the current phase where users supply their own
keys. Future item: migrate to Supabase per-user storage once auth is fully stabilized.

**Vault PIN hashing** — The PIN is stored as a hash in the `vault_settings` table. The
current implementation is not bcrypt/Argon2. Do not assume cryptographic strength or add
crypto libraries without explicit instruction.

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
do not rely on it by name.

| Branch | Purpose |
|---|---|
| `feature/<sprint-name>` | New feature work, pushed to GitHub |
| `fix/<description>` | Bug fixes, pushed to GitHub |
| `claude/<random-name>` (worktree) | Powers the local preview server only |

**PR workflow:**
1. Create `feature/<name>` (new work) or `fix/<name>` (bug fix) from master in the main repo
2. Make all commits on that branch — never on the `claude/*` worktree branch
3. Push and open PR from it

The `claude/*` worktree branch exists only to power the local preview server. It is
never pushed or used as a PR source.
