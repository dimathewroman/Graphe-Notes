# Graphe Notes — Claude Code Guide

> For full stack/architecture details see `replit.md`. This file covers what Claude Code needs to work effectively in this repo.

## Current Sprint
Phase: Vault & Demo Polish
In progress: Superscript/subscript dependency fix for Replit
Recently completed: Inline vault unlock, demo PIN session persistence

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

## Worktree Architecture (Claude Code)

This repo uses a Claude Code git worktree for the preview server:

| Branch | Purpose |
|---|---|
| `feature/editor-enhancements` | Main development branch, pushed to GitHub |
| `claude/happy-lamport` (worktree) | Powers the local preview server |

When editing shared files (`NoteEditor.tsx`, `Sidebar.tsx`, `store.ts`, etc.), **apply changes to both** the main repo file and the worktree file, then commit each separately.
