# Graphe Notes — Claude Code Guide

<!-- Last audited: 2026-04-24 -->

## Stack

- **Runtime**: Next.js 16 (App Router), React 19
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`), `@tailwindcss/typography`
- **State**: Zustand (client), TanStack Query v5 (server)
- **Animation**: Framer Motion 12
- **Editor**: Tiptap 3 (rich text, code blocks, tables, math, slash commands, images, task lists)
- **Auth**: Supabase Auth (Google/Apple OAuth, email/password)
- **Database**: Supabase PostgreSQL + Drizzle ORM 0.45
- **Validation**: Zod 3, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Monorepo**: pnpm workspaces
- **Deployment**: Vercel
- **Error tracking**: Sentry 10 (`@sentry/nextjs`)
- **Analytics**: PostHog (`posthog-js`, `posthog-node`)
- **UI primitives**: Radix UI (dialog, dropdown, toast, tooltip, toggle, label, separator, slot), Vaul (drawers), Sonner (toasts), Lucide icons
- **Other**: `jose` (JWT), `bcryptjs` (vault hashing), `html2pdf.js` (export), `turndown`/`turndown-plugin-gfm` (HTML-to-markdown), `date-fns`, `diff-match-patch` (version diffing), `katex` (math rendering), `lowlight` (code highlighting), `geist` (font), `next-themes`

---

## Agent Workspace

This codebase is managed by a team of specialist agents coordinated by DiMathew. The source of truth for all conventions, the definition of done, the PostHog event schema, Sentry setup status, and branch naming lives in Notion:

Graphe Notes — Private > Agent Workspace > Stack and Conventions Reference

After every completed task:
1. Update the Active Work database row for this task in Notion: set Status to QA Review, add the branch name, and add the Vercel preview URL.
2. If a significant architectural or engineering decision was made, log it to the Decision Log with a rationale.
3. If a change was reverted, log it to the Rollback Log with a reason and what to try instead.

DiMathew reviews all diffs on the Vercel preview before merging. Do not merge to master.

---

## Definition of Done

A task is not done until all of the following are true:
1. Code is on a named branch (never master)
2. Vercel preview URL is generated and functional
3. A posthog.capture() call is added for every new user-facing action (see PostHog section below)
4. A Sentry error boundary or try/catch with Sentry.captureException is added for every new failure surface
5. Sentry is checked for new unresolved issues before the PR is opened: resolve intentional test errors, fix any real errors caused by the branch, and resolve stale dev-build noise so the dashboard stays clean
6. The Notion Active Work row is updated with branch name, preview URL, and Status set to QA Review
7. A plain English summary is written of what was done and any follow-up tasks

---

## Project Structure

```
artifacts/next-app/            -- Next.js app (frontend + API routes)
  src/
    app/                       -- App Router pages + API route handlers
    components/                -- React components
      editor/                  -- Tiptap editor sub-components
      onboarding/              -- Onboarding modal
      templates/               -- Template picker + save-as-template
      ui/                      -- Shared UI primitives (button, dialog, drawer, etc.)
    hooks/                     -- Custom React hooks
    lib/                       -- Utilities (auth, Supabase clients, AI prompts, demo data, etc.)
    types/                     -- Type declarations
  e2e/                         -- Playwright e2e tests
  sentry.client.config.ts      -- Sentry client config
  sentry.server.config.ts      -- Sentry server config
  sentry.edge.config.ts        -- Sentry edge config
  next.config.ts               -- Next.js config (CSP headers, Sentry plugin, PostHog rewrites)
  playwright.config.ts         -- Playwright config

lib/api-spec/                  -- OpenAPI spec (openapi.yaml) + Orval codegen config
lib/api-client-react/          -- Generated React Query hooks + custom fetch
lib/api-zod/                   -- Generated Zod schemas
lib/db/                        -- Drizzle ORM schema + DB connection
lib/encryption.ts              -- AES-256-GCM encryption for AI provider keys

scripts/
  post-merge.sh                -- Runs pnpm install + db push after git pull/merge
  pre-push.sh                  -- Runs typecheck before every push
  seed-templates.ts            -- Seeds preset templates into DB
```

---

## Database Schema

Tables defined in `lib/db/src/schema/`:

- **users**: id, email, firstName, lastName, profileImageUrl, storageTier, createdAt, updatedAt
- **folders**: id, userId, name, parentId, color, icon, tagRules (text[]), sortOrder, createdAt, updatedAt
- **notes**: id, userId, title, content (HTML), contentText (plain), folderId, tags (text[]), pinned, favorite, vaulted, coverImage, deletedAt, autoDeleteAt, deletedReason, createdAt, updatedAt
- **note_versions**: id, noteId, userId, title, content, contentText, label, source, createdAt
- **vault_settings**: id, userId, passwordHash, createdAt, updatedAt
- **templates**: id, userId, name, description, category (capture|plan|reflect|create|mine), content (JSONB), isPreset, createdAt, updatedAt
- **attachments**: id, noteId, userId, fileName, fileType, fileSize, storagePath, displayMode, createdAt, deletedAt
- **quick_bits**: id, userId, title, content, contentText, expiresAt, notificationHours (int[]), createdAt, updatedAt
- **quick_bit_settings**: id, userId, defaultExpirationDays, defaultNotificationHours (int[]), createdAt, updatedAt
- **smart_folders**: id, userId, name, tagRules (text[]), color, sortOrder, createdAt, updatedAt
- **user_api_keys**: id, userId, provider, encryptedKey, endpointUrl, modelOverride, createdAt, updatedAt
- **user_settings**: userId, activeAiProvider, hasCompletedAiSetup, onboardingCompleted, accentColor, motionLevel, updatedAt
- **ai_usage**: id, userId, requestsThisHour, hourWindowStart, requestsThisMonth, monthWindowStart, totalTokensUsed, lastRequestAt, createdAt

Soft-delete pattern: `notes.deletedAt` is set on soft-delete. Use `/notes/:id/delete`, `/notes/:id/restore`, and `/notes/:id/permanent` endpoints — not a plain DELETE.

---

## API Endpoints

All endpoints live in `artifacts/next-app/src/app/api/` and are prefixed with `/api`:

**Notes**
- GET/POST /notes (filters: folderId, search, pinned, favorite, tag, sortBy, sortDir)
- GET/PATCH /notes/:id
- PATCH /notes/:id/pin
- PATCH /notes/:id/favorite
- PATCH /notes/:id/move
- PATCH /notes/:id/vault
- POST /notes/:id/delete (soft-delete)
- POST /notes/:id/restore
- DELETE /notes/:id/permanent
- GET /notes/:id/versions
- GET/DELETE /notes/:id/versions/:versionId
- POST /notes/:id/versions/:versionId/restore

**Folders**
- GET/POST /folders
- PATCH/DELETE /folders/:id

**Quick Bits**
- GET/POST /quick-bits
- GET/PATCH/DELETE /quick-bits/:id
- DELETE /quick-bits/:id/soft-delete
- GET/PATCH /quick-bits/settings
- DELETE /quick-bits/expired

**Templates**
- GET/POST /templates
- PATCH/DELETE /templates/:id

**Attachments**
- POST /attachments/upload
- GET /attachments/all
- GET /attachments/note/:noteId
- GET/DELETE /attachments/:attachmentId

**Vault**
- GET /vault/status
- POST /vault/setup
- POST /vault/unlock
- POST /vault/change-password

**AI**
- POST /ai/generate
- GET/POST/PATCH/DELETE /ai/keys
- GET/PATCH /ai/settings
- GET /ai/usage
- POST /ai/models

**Other**
- GET /tags
- GET/POST /smart-folders
- PATCH/DELETE /smart-folders/:id
- POST /onboarding
- GET /healthz
- POST /cron/purge-deleted (Vercel cron, daily at 3 AM UTC)

---

## Session Startup

At the start of every new session, before doing anything else:
1. Pull the latest master from GitHub: git checkout master and git pull origin master
2. Ask the user what feature or fix they are working on in this session.
   - Always create a new branch from master for the work: git checkout -b feature/name (or fix/name for bug fixes, chore/name for non-feature work like docs or config).
   - Exception: if the user explicitly says they are continuing an in-progress branch that has unmerged work, switch to that branch instead.
   - Never silently continue on whatever branch happens to already have commits. Each feature/fix must have its own dedicated branch and PR. Never put two features on the same branch.
3. Check that .env exists in the repo root -- if not, copy .env.example to .env and inform the user that real credentials from 1Password are needed for full login and DB access.
4. Run pnpm install from the repo root.
5. Start the Next.js dev server on port 3000.

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

# Seed preset templates
npx tsx scripts/seed-templates.ts
```

---

## Adding Packages

```bash
pnpm add some-package --filter @workspace/next-app
```

For packages shared across workspaces, add to the `catalog:` section of `pnpm-workspace.yaml` and reference it as `"catalog:"` in each package.json.

---

## Git Hooks

**post-merge** (`scripts/post-merge.sh`): Runs after every `git merge` or `git pull`:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter db push`

Do not skip or manually replicate these steps. Let the hook handle them.

**pre-push** (`scripts/pre-push.sh`): Runs `pnpm run typecheck` before every push. If typecheck fails, the push is blocked.

---

## API Client Pattern

Never write raw fetch calls. All API calls go through generated React Query hooks in `@workspace/api-client-react`.

To add a new endpoint:
1. Edit `lib/api-spec/openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen`
3. Import and use the generated hook

Query cache keys are exported alongside hooks: `getGetNotesQueryKey()`, `getGetNoteQueryKey(id)`, etc.

---

## Auth

Auth lives in `artifacts/next-app/src/hooks/use-auth.ts` and `artifacts/next-app/src/lib/supabase.ts`. The Supabase client uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-side auth uses `artifacts/next-app/src/lib/auth-server.ts` with the admin client in `artifacts/next-app/src/lib/supabase-admin.ts`.

---

## Demo Mode Pattern

`useDemoMode()` returns a boolean. Import from `@/lib/demo-context`.

In demo mode, patch the React Query cache directly instead of calling API mutations:
```typescript
queryClient.setQueryData(getGetNoteQueryKey(id), { ...existing, vaulted: true })
```

Demo vault PIN is stored in sessionStorage under the key `"demo_vault_hash"`. Always use sessionStorage as the source of truth for whether a PIN is configured in demo mode.

---

## State Management

| Concern | Where |
|---|---|
| Selected note/quickbit, active filter, sidebar/note-list visibility, vault unlock, motion level, dark mode level, colorblind mode, template picker, onboarding, AI setup modal | Zustand — `artifacts/next-app/src/store.ts` |
| Server data (notes, folders, tags, vault status, templates, attachments) | React Query (TanStack Query v5) |

---

## Motion Level System

Three motion levels: `full`, `reduced`, `minimal`. Stored in Zustand and persisted to `user_settings.motionLevel`.

- `useMotionLevel()` — returns current level
- `useSetMotionLevel()` — setter that also captures PostHog event
- `useMotionInit()` — call once at app root; syncs `prefers-reduced-motion` and sets `data-motion` attribute on `<html>`
- `useAnimationConfig()` — returns Framer Motion transition objects tuned to the current level

All Framer Motion components should use `useAnimationConfig()` rather than hardcoding durations. Hook lives in `artifacts/next-app/src/hooks/use-motion.ts`.

---

## Atmosphere System

Dark mode intensity levels (`soft`, `default`, `oled`) and colorblind modes (`none`, `protanopia`, `tritanopia`). Sets `data-dark-level` and `data-colorblind` attributes on `<html>` so CSS in `globals.css` can remap surface tokens. Hook lives in `artifacts/next-app/src/hooks/use-atmosphere.ts`.

---

## Editor Architecture

The editor is split into two layers:

- **NoteShell.tsx** (`components/NoteShell.tsx`, ~910 lines) — orchestrator for full notes. Contains note header, save logic, title/tag state, version history panel, vault state, and all note-specific orchestration.
- **GrapheEditor.tsx** (`components/editor/GrapheEditor.tsx`, ~363 lines) — the Tiptap editor instance. Shared between notes and quick bits.

Editor sub-components in `components/editor/`:
- `EditorToolbar.tsx` — full toolbar (font, size, formatting, link, etc.)
- `AiSelectionMenu.tsx` / `MobileSelectionMenu.tsx` — floating AI menus
- `NoteHeader.tsx` — top bar (save status, actions, overflow/export menus)
- `NoteBody.tsx` — title input + tags + editor content
- `AttachmentPanel.tsx` — file attachment management
- `FindReplace.tsx` — find and replace
- `SlashCommandMenu.tsx` — slash command menu
- `TableOfContents.tsx` — document outline
- `ScrollableToolbar.tsx` — horizontally scrollable mobile toolbar
- Various dropdowns: `ColorPickerDropdown`, `FontPickerDropdown`, `FontSizeWidget`, `LinkPopover`, `WordCountPopover`, `ExportMenu`, `OverflowMenu`

Key hooks:
- `hooks/use-ai-action.ts` — AI call flow with first-time setup modal
- `hooks/use-note-export.ts` — export functionality
- `hooks/use-note-versions.ts` — version history management
- `hooks/use-attachments.ts` — attachment CRUD
- `lib/ai-prompts.ts` — single source of truth for AI prompt strings

Do not add new editor UI directly into NoteShell.tsx — create sub-components in `components/editor/`.

---

## Templates System

Preset and user-created templates stored in the `templates` table. Categories: capture, plan, reflect, create, mine.

- `components/templates/TemplatePickerModal.tsx` — modal to browse and apply templates
- `components/templates/SaveAsTemplateDialog.tsx` — save current note/quickbit as template
- Template picker state managed in Zustand: `isTemplatePickerOpen`, `templatePickerContext` ("note" | "quickbit")
- Preset templates seeded via `scripts/seed-templates.ts`

---

## Onboarding System

4-step first-run onboarding flow for new users and demo mode.

- `components/onboarding/OnboardingModal.tsx` — the modal UI
- `hooks/use-onboarding.ts` — trigger logic (checks `user_settings.onboardingCompleted` for auth users, sessionStorage for demo)
- API: `POST /onboarding` marks onboarding complete
- State in Zustand: `isOnboardingOpen`, `onboardingStep`

---

## Toolbar Popover Pattern

All toolbar menus (color picker, word count, font picker, font size, link popover) must:
- Render via `ReactDOM.createPortal` targeting `document.body`
- Position using `getBoundingClientRect()` on the trigger button
- Clamp to viewport with at least 8px padding on all edges
- Use `z-50`
- Close on outside click and Escape key

Never render toolbar dropdowns as direct children of the toolbar — they will be clipped.

---

## Responsive Breakpoints

`useBreakpoint()` from `src/hooks/use-mobile.tsx` returns `"mobile" | "tablet" | "desktop"`

- Mobile: < 768px
- Tablet: 768–1199px
- Desktop: 1200px+

The tablet threshold is 1200px (not 1024) so iPad Pro in portrait gets the 2-column tablet layout. Mobile is single-column with no persistent panels. Always ensure a back navigation button exists on every mobile screen including vault-locked notes.

---

## Path Aliases

`artifacts/next-app` defines two aliases in `tsconfig.json`:
- `@/*` → `./src/*` (app-internal imports)
- `@lib/*` → `../../lib/*` (shared lib imports, e.g. `@lib/encryption`)

---

## Tailwind CSS

Version 4 via `@tailwindcss/postcss`. Global styles in `artifacts/next-app/src/app/globals.css`. Use `@import "tailwindcss"` at the top of CSS files. No tailwind.config.* needed unless customizing the theme.

---

## PostHog

PostHog is used for analytics. Import the `posthog-js` client from the PostHog provider. Server-side PostHog client in `lib/posthog-server.ts`.

Event naming format: `noun_verb`

Baseline events already instrumented:
- note_created, note_opened, note_deleted
- editor_opened, sync_triggered, search_performed
- motion_level_changed

All events must include a properties object with at minimum: `timestamp` and any relevant IDs (`note_id`, `user_id` where available).

Adding a `posthog.capture()` call for every new user-facing action is part of the definition of done.

PostHog requests are proxied through Next.js rewrites (`/ingest/*`) to avoid ad blockers.

---

## Sentry

Sentry 10 (`@sentry/nextjs`) is used for error tracking. Config files:
- `artifacts/next-app/sentry.client.config.ts`
- `artifacts/next-app/sentry.server.config.ts`
- `artifacts/next-app/sentry.edge.config.ts`

Source maps are uploaded to Sentry on every Vercel build via the Sentry plugin in `next.config.ts` (org: `dimathew-roman`, project: `javascript-nextjs`).

Every component or function that can fail must have either a `Sentry.ErrorBoundary` wrapper or a `try/catch` with `Sentry.captureException(error)`.

---

## Security Headers

`next.config.ts` sets CSP, X-Frame-Options (DENY), HSTS, and other security headers on all routes. When adding new external domains (CDNs, APIs), update the CSP `connect-src` directive.

---

## Environment Variables

| Variable | Required by | Notes |
|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | frontend | Client-safe Supabase project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | frontend | Client-safe public anon key |
| SUPABASE_URL | API routes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | API routes | Admin operations — never expose to frontend |
| SUPABASE_DB_URL | lib/db (Drizzle) | Session-mode pooler connection string |
| AI_KEY_ENCRYPTION_SECRET | API routes | 32-byte hex secret for AES-256-GCM encryption of AI keys |
| GEMINI_API_KEY | API routes | Google Gemini API key |
| CRON_SECRET | Vercel cron | Authenticates cron requests |
| SENTRY_AUTH_TOKEN | build | Sentry source map upload token |
| NEXT_PUBLIC_SENTRY_DSN | frontend + server | Sentry DSN (public, safe for client) |
| NEXT_PUBLIC_POSTHOG_KEY | frontend | PostHog project token |
| NEXT_PUBLIC_POSTHOG_HOST | frontend | PostHog host URL |

For local dev, copy `.env.example` to `.env` at the repo root and fill in credentials.

---

## Vercel Deployment

`vercel.json` at the repo root:
- Build command: `pnpm --filter @workspace/next-app run build`
- Output directory: `.next`
- Install command: `pnpm install`
- Cron: `POST /api/cron/purge-deleted` runs daily at 3 AM UTC (hard-deletes expired soft-deleted notes)

Branch strategy: `master` is production. `feature/*`, `fix/*`, and `chore/*` branches get Vercel preview deployments automatically.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| master | Production — Vercel deploys from here |
| feature/name | New feature work, branched from master |
| fix/name | Bug fixes, branched from master |
| chore/name | Docs, config, non-feature work |

One feature = one branch = one PR. Never put two features on the same branch.

---

## Git Workflow

### Starting a new session
1. Always run `git fetch origin` and `git checkout master` and `git pull origin master` first.
2. If the user says to continue work on an existing branch, `git checkout branch-name`.
3. If starting new work, create a new branch from the freshly-pulled master.

### During work
- Commit frequently with clear, descriptive messages
- All commits are local until explicitly pushed

### Finishing work
1. Push the branch: `git push -u origin branch-name`
2. Create a PR: `gh pr create --title "title" --body "description"`
3. Do NOT merge the PR. DiMathew reviews and merges manually.
4. Update the Notion Active Work row: Status to QA Review, branch name, Vercel preview URL.

---

## Testing

Playwright e2e tests live in `artifacts/next-app/e2e/`. Tests run against the Next.js dev server on port 3000.

```bash
# Run the full e2e suite (from repo root)
pnpm --filter @workspace/next-app run test:e2e

# Or from artifacts/next-app/
npx playwright test
```

Test files:
- `e2e/01-app-loads.spec.ts` — login screen loads, demo mode boots
- `e2e/02-notes.spec.ts` — create, open, delete, and search notes
- `e2e/03-quick-bits.spec.ts` — Quick Bits list and navigation
- `e2e/04-vault.spec.ts` — vault setup, PIN flow, and vaulting notes
- `e2e/05-micro-interactions.spec.ts` — micro-interaction tests
- `e2e/06-templates.spec.ts` — template picker and save-as-template
- `e2e/07-onboarding.spec.ts` — onboarding flow

All tests use demo mode (no auth credentials needed). The helper `e2e/helpers.ts` exports `enterDemoMode(page)` which lands on All Notes with demo data pre-seeded.

Use `data-testid` attributes for all selectors — never couple tests to CSS classes.

Tests run serially (`workers: 1`) because the Next.js dev server cannot reliably handle concurrent test workers.

---

## Codebase Caveats

FontSize is a named export from `@tiptap/extension-text-style`. Do not install `@tiptap/extension-font-size` — it is deprecated.

AI provider keys are stored encrypted in the `user_api_keys` DB table. The encryption utility is in `lib/encryption.ts` (AES-256-GCM, imported via `@lib/encryption`). The active provider setting is in `user_settings`. Do not use localStorage for AI keys.

---

## Working Convention

- Run routine commands (git status/log/diff/branch/add/commit/push, pnpm install/typecheck/build, chmod, mkdir, rm within the repo) without asking for permission.
- Only ask for confirmation before destructive or hard-to-reverse operations: force push, git reset --hard, deleting branches, dropping the database, or anything that affects shared/remote state beyond a normal commit+push.
- Only modify code files within the Graphe-Notes repository. Installing packages and running dev tools is fine. Never modify unrelated projects or system configuration files.
- Never delete files without explaining what and why. Wait for confirmation.
- Never commit directly to master. Always use a feature branch. One feature = one branch = one PR.
- When something goes wrong, stop immediately and explain before attempting a fix.
