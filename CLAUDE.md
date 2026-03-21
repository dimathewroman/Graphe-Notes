# Graphe Notes — Claude Code Guide

## Stack
- Frontend: Next.js 15 (App Router), React 19, Tailwind CSS v4, TanStack Query v5, Zustand, Framer Motion, Tiptap
- Backend: Next.js API Route Handlers (in artifacts/next-app/src/app/api/)
- Auth: Supabase Auth (Google/Apple OAuth, email/password)
- Database: Supabase PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Monorepo: pnpm workspaces
- Deployment: Vercel

---

## Project Structure

```
artifacts/next-app/        -- Next.js app (frontend + API routes)
artifacts/mockup-sandbox/  -- Component preview sandbox
lib/api-spec/              -- OpenAPI spec + Orval codegen config
lib/api-client-react/      -- Generated React Query hooks
lib/api-zod/               -- Generated Zod schemas
lib/db/                    -- Drizzle ORM schema + DB connection
scripts/                   -- Utility scripts
```

---

## Database Schema

- folders: id, name, parentId, color, icon, sortOrder, createdAt, updatedAt
- notes: id, title, content (HTML), contentText (plain), folderId, tags (text[]), pinned, favorite, vaulted, coverImage, createdAt, updatedAt
- vault_settings: id, passwordHash, createdAt, updatedAt

---

## API Endpoints

All endpoints live in artifacts/next-app/src/app/api/ and are prefixed with /api:

- GET/POST /folders
- PATCH/DELETE /folders/:id
- GET/POST /notes (filters: folderId, search, pinned, favorite, tag, sortBy, sortDir)
- GET/PATCH/DELETE /notes/:id
- PATCH /notes/:id/pin
- PATCH /notes/:id/favorite
- PATCH /notes/:id/move
- PATCH /notes/:id/vault (body: { vaulted: boolean })
- GET /tags
- GET /vault/status
- POST /vault/setup
- POST /vault/unlock
- POST /vault/change-password
- POST /ai/complete (provider: openai|anthropic|google, apiKey, model, prompt)
- GET/POST /models

---

## Session Startup

At the start of every new session, before doing anything else:
1. Pull the latest master from GitHub into the local main repo
2. Create a new worktree branching from that updated local master
3. Check that .env exists in the repo root -- if not, copy .env.example to .env and inform the user that real credentials from 1Password are needed for full login and DB access
4. Run pnpm install from the worktree root
5. Start the Next.js dev server on port 3000

Do this automatically without being asked.

---

## Common Commands

```bash
# Dev server (Next.js, port 3000)
pnpm --filter @workspace/next-app run dev

# Typecheck -- always run from repo root
pnpm run typecheck

# Push DB schema changes
pnpm --filter @workspace/db run push

# Regenerate API hooks and Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

---

## Adding Packages

```bash
pnpm add some-package --filter @workspace/next-app
```

For packages shared across workspaces, add to the catalog: section of pnpm-workspace.yaml and reference it as "catalog:" in each package.json.

---

## Post-Merge Hook

A git post-merge hook lives at scripts/post-merge.sh. It runs automatically after every git merge or git pull and does two things:
1. pnpm install --frozen-lockfile
2. pnpm --filter db push

Do not skip or manually replicate these steps. Let the hook handle them.

---

## API Client Pattern

Never write raw fetch calls. All API calls go through generated React Query hooks in @workspace/api-client-react.

To add a new endpoint:
1. Edit lib/api-spec/openapi.yaml
2. Run pnpm --filter @workspace/api-spec run codegen
3. Import and use the generated hook

Query cache keys are exported alongside hooks: getGetNotesQueryKey(), getGetNoteQueryKey(id), etc.

---

## Auth

Auth lives in artifacts/next-app/src/hooks/use-auth.ts and artifacts/next-app/src/lib/supabase.ts. The Supabase client uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Server-side auth validation uses SUPABASE_SERVICE_ROLE_KEY via artifacts/next-app/src/lib/auth-server.ts.

---

## Demo Mode Pattern

useDemoMode() returns isDemo: boolean. Import from @/app/providers.

In demo mode, patch the React Query cache directly instead of calling API mutations:
```tsx
queryClient.setQueryData(getGetNoteQueryKey(id), { ...existing, vaulted: true })
```

Demo vault PIN is stored in sessionStorage under the key "demo_vault_hash". Always use sessionStorage as the source of truth for whether a PIN is configured in demo mode.

---

## State Management

| Concern | Where |
|---|---|
| Selected note, active filter, sidebar/note-list visibility, vault unlock | Zustand -- artifacts/next-app/src/store.ts |
| Server data (notes, folders, tags, vault status) | React Query (TanStack Query v5) |

---

## Responsive Breakpoints

useBreakpoint() from src/hooks/use-mobile.tsx returns "mobile" | "tablet" | "desktop"

- Mobile < 768px
- Tablet 768-1023px
- Desktop 1024px+

Mobile is single-column with no persistent panels. Always ensure a back navigation button exists on every mobile screen including vault-locked notes.

---

## Toolbar Popover Pattern

All toolbar menus (color picker, word count, font picker, font size, link popover) must:
- Render via ReactDOM.createPortal targeting document.body
- Position using getBoundingClientRect() on the trigger button
- Clamp to viewport with at least 8px padding on all edges
- Use z-50
- Close on outside click and Escape key

Never render toolbar dropdowns as direct children of the toolbar -- they will be clipped.

---

## Path Alias

artifacts/next-app uses @/ as an alias for src/. Use @/components/..., @/hooks/..., @/lib/..., etc. in all imports.

---

## Tailwind CSS

Version 4 via @tailwindcss/postcss. Global styles in artifacts/next-app/src/app/globals.css. Use @import "tailwindcss" at the top of CSS files. No tailwind.config.* needed unless customizing the theme.

---

## Environment Variables

| Variable | Required by | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | frontend | Client-safe Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | frontend | Client-safe public anon key |
| SUPABASE_URL | API routes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | API routes only | Admin operations -- never expose to frontend |
| SUPABASE_DB_URL | lib/db (Drizzle) | Session-mode pooler connection string |

For local dev, copy .env.example to .env at the repo root and fill in credentials.

---

## Vercel Deployment

vercel.json at the repo root configures Vercel to build from the monorepo:
- Build command: pnpm --filter @workspace/next-app run build
- Output directory: artifacts/next-app/.next
- Install command: pnpm install

Branch strategy: master is production. feature/* and fix/* branches get Vercel preview deployments automatically.

---

## Worktree Architecture

The worktree branch name is randomized each session (e.g. claude/modest-albattani) -- do not rely on it by name. The worktree is always created from master.

| Branch | Purpose |
|---|---|
| feature/<n> | New feature work, branched from master, pushed to GitHub |
| fix/<description> | Bug fixes, branched from master, pushed to GitHub |
| claude/<random-name> (worktree) | Powers the local preview server only -- never pushed |

PR workflow:
1. Create feature/<n> or fix/<n> from master
2. Make all commits on that branch, never on the claude/* worktree branch
3. Push and open PR targeting master

---

## Codebase Caveats

No tests exist. Do not suggest or scaffold tests unless explicitly asked.

NoteEditor.tsx is very large. Be surgical -- read only the relevant section before editing. Never rewrite sections you are not directly changing.

Toolbar menus are portaled. See Toolbar Popover Pattern above.

FontSize is a named export from @tiptap/extension-text-style. Do not install @tiptap/extension-font-size -- it is deprecated.

AI provider keys (OpenAI, Anthropic, Gemini) are stored in plaintext localStorage. This is intentional for the current phase where users supply their own keys.

---

## Working Convention

- Before running any terminal command, explain what it does, why it is necessary, what it affects, and whether it is reversible. Wait for confirmation.
- Only modify code files within the Graphe-Notes repository. Installing packages and running dev tools is fine. Never modify unrelated projects or system configuration files.
- Never delete files without explaining what and why. Wait for confirmation.
- Never commit directly to master. Always use a feature branch.
- When something goes wrong, stop immediately and explain before attempting a fix.
