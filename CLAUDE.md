# Graphe Notes — Claude Code Guide

> For full stack/architecture details see `replit.md`. This file covers what Claude Code needs to work effectively in this repo.

## Session Startup
At the start of every new session, before doing anything else:
1. Pull the latest master from GitHub into the local main repo
2. Create a new worktree branching from that updated local master
3. Run pnpm install from the worktree root
4. Start the preview server targeting @workspace/notes-app
Do this automatically without being asked.

---

## Common Commands

```bash
# Dev server (frontend, port 5173)
pnpm --filter @workspace/notes-app run dev

# Typecheck — always run from repo root
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
- For packages shared across multiple workspaces, add to the `catalog:` section of `pnpm-workspace.yaml` and reference it as `"catalog:"` in each `package.json`.

---

## API Client Pattern

- **Never write raw fetch calls.** All API calls go through generated React Query hooks in `@workspace/api-client-react`.
- To add a new endpoint:
  1. Edit `lib/api-spec/openapi.yaml`
  2. Run `pnpm --filter @workspace/api-spec run codegen`
  3. Import and use the generated hook
- Query cache keys are exported alongside hooks: `getGetNotesQueryKey()`, `getGetNoteQueryKey(id)`, etc.

---

## Demo Mode Pattern

- `useDemoMode()` returns `isDemo: boolean`. Import from the demo context.
- In demo mode, **patch the React Query cache directly** instead of calling API mutations:
  ```tsx
  queryClient.setQueryData(getGetNoteQueryKey(id), { ...existing, vaulted: true });
  ```
- **Demo vault PIN** is stored in `sessionStorage` under the key `"demo_vault_hash"`. Always use sessionStorage as the source of truth for whether a PIN is configured in demo mode — the React Query vault status cache (`["/api/vault/status"]`) may refetch and clear.

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
- Mobile is single-column (no persistent panels). Always ensure a back navigation button exists on every mobile screen, including edge cases like vault-locked notes.

---

## Path Alias

- The frontend uses `@/` as an alias for `src/`. Use `@/components/...`, `@/hooks/...`, `@/lib/...`, etc. in all imports within `artifacts/notes-app`.

---

## Environment Variables

All env vars are injected at build/runtime — no `.env` files are committed.

| Variable | Required by | Notes |
|---|---|---|
| `SUPABASE_URL` | frontend + backend | Supabase project URL |
| `SUPABASE_ANON_KEY` | frontend + backend | Public anon key, safe for client |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only | Admin operations — never expose to frontend |
| `SUPABASE_DB_URL` | `lib/db` (Drizzle) | Session-mode pooler connection string |
| `PORT` | frontend (Vite) | Dev server port |
| `BASE_PATH` | frontend (Vite) | URL base path |

---

## Codebase Caveats

**No tests exist.** There is no test runner configured (no Vitest, Jest, or testing library). Do not suggest or scaffold tests unless explicitly asked.

**`NoteEditor.tsx` is large (~73KB).** It is the biggest file in the repo. Be surgical — read only the relevant section before editing.

**AI provider keys** (OpenAI, Anthropic, Gemini) are stored in **plaintext `localStorage`**. This is intentional for the current phase where users supply their own keys. Future sprint item: migrate to Supabase per-user storage once auth is fully stabilized.

**Vault PIN hashing** — The PIN is stored as a hash in the `vault_settings` table. The current implementation is not bcrypt/Argon2. Do not assume cryptographic strength or add crypto libraries without explicit instruction.

---

## Working Convention

- Before running any terminal command, explain in plain English what it does, why it is necessary, what it affects, and whether it is reversible. Wait for confirmation.
- Only modify code files within the Graphe-Notes repository. Installing packages and running dev tools is fine. Never modify unrelated projects or system configuration files.
- Never delete files without explicitly telling me what you are deleting and why. Wait for confirmation.
- Never commit directly to master. Always use a feature branch.
- When something goes wrong, stop immediately and explain what happened before attempting a fix.

---

## Worktree Architecture (Claude Code)

The worktree branch name is randomized each session. All edits happen in the worktree only. Never edit main repo files directly during a session. Use a feature branch per sprint, submit a PR when done, never commit to master.
