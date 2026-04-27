# Graphe Notes — Claude Code Guide

<!-- Last audited: 2026-04-26 -->

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
- **UI primitives**: shadcn/ui (new-york style) wrapping Radix UI (`radix-ui` monorepo package), Vaul (drawers), Sonner (toasts), Lucide icons. Components live in `src/components/ui/` and the shadcn config is in `artifacts/next-app/components.json`.
- **Other**: `jose` (JWT), `bcryptjs` (vault hashing), `html2pdf.js` (export), `turndown`/`turndown-plugin-gfm` (HTML-to-markdown), `date-fns`, `diff-match-patch` (version diffing), `katex` (math rendering), `lowlight` (code highlighting), `geist` (font), `next-themes`

---

## Documentation Map

This file contains behavioral instructions for Claude Code. Detailed reference lives in dedicated files — only read them when your task requires it.

| File | Contains | Read when... |
|---|---|---|
| [CLAUDE.md](CLAUDE.md) (this file) | Working conventions, PR checklist, session startup, branch strategy | Always (loaded automatically) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Directory tree, database schema, API endpoints, auth flow, state management, component hierarchy, data fetching patterns | You need to find where something lives, understand data flow, or add new endpoints/tables |
| [DESIGN.md](DESIGN.md) | Color system, typography scale, spacing tokens, component visual patterns, motion timing, border radii, dark mode specs | You're making any UI or visual change |
| [PERFORMANCE.md](PERFORMANCE.md) | Performance baselines, thresholds, testing instructions, anti-patterns | You're working on performance-sensitive code or before submitting a PR with potential perf impact |
| [TESTING.md](TESTING.md) | How to run tests, how to add tests, CI pipeline, visual regression, viewport testing | You're writing or modifying tests |
| [SECURITY.md](SECURITY.md) | Security model, RLS policies, auth patterns, rate limiting, encryption, audit history | You're adding new endpoints, tables, or anything touching auth/data access |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Sentry setup, PostHog event schema, monitoring dashboards, what to check and when | You're adding error handling, analytics events, or debugging production issues |

**Rule: Before making UI changes, read [DESIGN.md](DESIGN.md). Before making architectural changes, read [ARCHITECTURE.md](ARCHITECTURE.md). Before submitting any PR, run through the PR checklist below.**

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
8. If any UI was changed: verify it renders correctly at mobile (390px), tablet (768px), and desktop (1280px+) widths. All interactive elements have touch targets of at least 44x44px. Tested in both light and dark mode.
9. If adding interactive elements: verify they work with both pointer/mouse and touch input. No functionality gated behind hover.
10. If adding CSS animations or visual effects: verify they work in Safari/WebKit, not just Chrome.
11. If adding new API endpoints or database tables: verify RLS policies are in place, auth is validated in the handler, and no cross-user data access is possible.
12. If changes touch auth, encryption, or rate limiting: verify no new security vectors are introduced.

---

## Project Structure

Full annotated directory tree in [ARCHITECTURE.md](ARCHITECTURE.md). Key paths: `artifacts/next-app/src/` (frontend + API routes), `lib/` (shared utilities, DB, codegen), `scripts/` (git hooks, seed scripts).

---

## Database Schema

Full schema with column definitions, RLS status, and soft-delete patterns in [ARCHITECTURE.md](ARCHITECTURE.md). 13 tables defined in `lib/db/src/schema/`.

> **Important:** `user_settings` stores only `userId`, `activeAiProvider`, `hasCompletedAiSetup`, `updatedAt`. Motion level, dark mode level, colorblind mode, accent color, and onboarding state are **localStorage-only** — they are not in the database.

---

## API Endpoints

Full endpoint list in [ARCHITECTURE.md](ARCHITECTURE.md). All handlers live in `artifacts/next-app/src/app/api/` and are prefixed `/api`.

---

## Session Startup

At the start of every new session, before doing anything else:
1. Pull the latest master from GitHub: git checkout master and git pull origin master
2. Ask the user what feature or fix they are working on in this session.
   - Always create a new branch from master for the work: git checkout -b feature/name (or fix/name for bug fixes, chore/name for non-feature work like docs or config, refactor/name for restructuring without behavior change, test/name for test-only changes).
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

<!-- TO EXTRACT: This section moves to ARCHITECTURE.md in the documentation restructure. CLAUDE.md will keep a 1-2 line summary with a pointer. -->
## Demo Mode Pattern

`useDemoMode()` returns a boolean. Import from `@/lib/demo-context`.

In demo mode, patch the React Query cache directly instead of calling API mutations:
```typescript
queryClient.setQueryData(getGetNoteQueryKey(id), { ...existing, vaulted: true })
```

Demo vault PIN is stored in sessionStorage under the key `"demo_vault_hash"`. Always use sessionStorage as the source of truth for whether a PIN is configured in demo mode.

---

<!-- TO EXTRACT: This section moves to ARCHITECTURE.md in the documentation restructure. CLAUDE.md will keep a 1-2 line summary with a pointer. -->
## State Management

| Concern | Where |
|---|---|
| Selected note/quickbit, active filter, sidebar/note-list visibility, vault unlock, motion level, dark mode level, colorblind mode, template picker, onboarding, AI setup modal | Zustand — `artifacts/next-app/src/store.ts` |
| Server data (notes, folders, tags, vault status, templates, attachments) | React Query (TanStack Query v5) |

---

## Motion Level System

Three motion levels: `full`, `reduced`, `minimal`. Stored in Zustand and persisted to `localStorage` (`motion_level` key).

- `useMotionLevel()` — returns current level
- `useSetMotionLevel()` — setter that also captures PostHog event
- `useMotionInit()` — call once at app root; syncs `prefers-reduced-motion` and sets `data-motion` attribute on `<html>`
- `useAnimationConfig()` — returns Framer Motion transition objects tuned to the current level

All Framer Motion components should use `useAnimationConfig()` rather than hardcoding durations. Hook lives in `artifacts/next-app/src/hooks/use-motion.ts`.

---

## Atmosphere System

Dark mode intensity levels (`soft`, `default`, `oled`) and colorblind modes (`none`, `protanopia`, `tritanopia`). Sets `data-dark-level` and `data-colorblind` attributes on `<html>` so CSS in `globals.css` can remap surface tokens. Hook lives in `artifacts/next-app/src/hooks/use-atmosphere.ts`.

---

<!-- TO EXTRACT: This section moves to ARCHITECTURE.md in the documentation restructure. CLAUDE.md will keep a 1-2 line summary with a pointer. -->
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

<!-- TO EXTRACT: This section moves to ARCHITECTURE.md in the documentation restructure. CLAUDE.md will keep a 1-2 line summary with a pointer. -->
## Templates System

Preset and user-created templates stored in the `templates` table. Categories: capture, plan, reflect, create, mine.

- `components/templates/TemplatePickerModal.tsx` — modal to browse and apply templates
- `components/templates/SaveAsTemplateDialog.tsx` — save current note/quickbit as template
- Template picker state managed in Zustand: `isTemplatePickerOpen`, `templatePickerContext` ("note" | "quickbit")
- Preset templates seeded via `scripts/seed-templates.ts`

---

<!-- TO EXTRACT: This section moves to ARCHITECTURE.md in the documentation restructure. CLAUDE.md will keep a 1-2 line summary with a pointer. -->
## Onboarding System

4-step first-run onboarding flow for new users and demo mode.

- `components/onboarding/OnboardingModal.tsx` — the modal UI
- `hooks/use-onboarding.ts` — trigger logic (checks `user_settings.onboardingCompleted` for auth users, sessionStorage for demo)
- API: `POST /onboarding` marks onboarding complete
- State in Zustand: `isOnboardingOpen`, `onboardingStep`

---

<!-- TO EXTRACT: This section moves to ARCHITECTURE.md (conventions/anti-patterns) and DESIGN.md (visual patterns) in the documentation restructure. CLAUDE.md will keep a 1-2 line summary with a pointer. -->
## shadcn/ui Patterns

All modals, dropdowns, popovers, and tooltips use shadcn/ui components (`src/components/ui/`) which wrap Radix primitives. Do NOT hand-roll new modal/popover code with `createPortal` + `getBoundingClientRect` + manual click-outside listeners — use the shadcn primitives instead.

### Toolbar dropdowns and popovers

- Toolbar menus (export, overflow, font picker, word count, link, color picker, font size) use `DropdownMenu` or `Popover` from shadcn. Radix handles positioning, collision detection, click-outside, and Escape automatically — no `createPortal` or `getBoundingClientRect` needed.
- For popovers whose trigger lives in a separate component (e.g. ColorPickerDropdown receives `triggerRef` from EditorToolbar), use `<PopoverAnchor virtualRef={triggerRef as React.RefObject<HTMLElement>} />` to position the content relative to an external trigger.

### Modals with Framer Motion enter/exit animation

Modals that need spring/scale exit animations (SettingsModal, AISetupModal, SaveAsTemplateDialog, TemplatePickerModal) use the raw Radix primitives directly — NOT the shadcn `DialogContent` wrapper, which bundles its own Portal+Overlay and conflicts with `forceMount` + `asChild`.

Pattern:
```tsx
import { Dialog as DialogPrimitive } from "radix-ui";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogPrimitive.Portal forceMount>
    <AnimatePresence>
      {open && (
        <>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div initial={...} animate={...} exit={...} />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content forceMount asChild
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => e.preventDefault()}>
            <motion.div initial={...} animate={...} exit={...}>
              {children}
            </motion.div>
          </DialogPrimitive.Content>
        </>
      )}
    </AnimatePresence>
  </DialogPrimitive.Portal>
</Dialog>
```

Simpler modals without exit animations (FolderEditModal, VaultModal, QuickBitShell ExpiredModal) use the shadcn `<Dialog><DialogContent>` wrapper directly.

For confirm/cancel dialogs, use `<AlertDialog>` instead of `<Dialog>`.

### ScrollArea in flex contexts

Radix `ScrollArea`'s Viewport is `size-full`, so it expands to its parent's bounded height. When the ScrollArea is a `flex-1` child of a flex column, you MUST also add `min-h-0`:

```tsx
<div className="h-screen flex flex-col">
  <header />
  <ScrollArea className="flex-1 min-h-0">  {/* min-h-0 is required */}
    <div className="p-2">{children}</div>
  </ScrollArea>
</div>
```

Without `min-h-0`, flex children don't shrink below their content size — the ScrollArea expands to content height and never scrolls.

### IconButton and ToolbarButton

`IconButton` and `ToolbarButton` are thin internal wrappers around shadcn `Button` (variant=ghost) and `Toggle` respectively. They preserve the existing API for ~50 consumer files and add app-specific tactile feedback (hover scale, touch targets, `active-elevate-2`). Don't replace existing consumers with raw `<Button>` — keep using the wrappers.

### VersionHistoryPanel — non-modal Sheet

The version history panel uses raw Radix Dialog with `modal={isMobile}` so the desktop slide-in panel doesn't dim or block the editor. Mobile keeps the modal bottom-sheet behavior.

### Custom color picker

The custom color picker (`ColorPickerDropdown`) uses pending state — color is NOT applied on every drag/slider change (which would call `editor.focus()` and steal focus from the popover). The user commits via the OK button or discards via Cancel. The PopoverContent has `onFocusOutside={(e) => e.preventDefault()}` to prevent close on focus changes.

### Adding new shadcn components

Run from `artifacts/next-app/`:
```bash
pnpm dlx shadcn@latest add <component>
```
This adds the component to `src/components/ui/`. After install, verify it doesn't overwrite custom files (IconButton, ToolbarButton, sonner, drawer, drawer-left, empty, ResizeHandle).

---

## Responsive Breakpoints

`useBreakpoint()` from `src/hooks/use-mobile.tsx` returns `"mobile" | "tablet" | "desktop"`.

Current hook thresholds: mobile < 768px, tablet 768-1199px, desktop 1200+. These may need updating to align with the design manifesto breakpoints below.

Supported viewport range (must not break at any width in this range):
- Cover screen minimum: 344px (Galaxy Fold cover)
- Mobile: < 600px — single-panel stack, 75% desktop spacing
- Tablet portrait / foldable outer: 600-768px — single-panel with sheet overlays
- Foldable inner: 700-900px near-square — two-panel, test 1:1-ish ratios
- Tablet landscape: 768-1024px — two-panel, sidebar collapses
- Desktop: > 1024px — three-panel, draggable dividers
- Split-screen (macOS/iPadOS): first-class layout, must not break

Always ensure a back navigation button exists on every mobile screen including vault-locked notes.

---

## Cross-Platform Requirements

This app must work on:
- Mobile: iOS Safari, Android Chrome
- Tablet: iPad with both touch and keyboard+cursor input (simultaneously), Android tablets
- Foldable: cover screen (344px) and inner screen, smooth reflow on fold transition
- Desktop: Chrome, Firefox, Safari/WebKit
- Split-screen / multitasking on macOS and iPadOS

WebKit is non-negotiable — all iOS and iPadOS browsers use WebKit as their rendering engine. A feature that works in Chromium but breaks in WebKit is broken for all Apple device users.

---

## Touch & Input Requirements

- All interactive elements must have a minimum touch target of 44x44px on touch devices. Hard minimum from Apple HIG.
- Hover states are pointer-only. Never gate functionality behind hover — every action reachable via hover must be reachable by tap or keyboard.
- On touch-only devices, hover effects either don't appear or translate to active/press states.
- iPad supports keyboard+trackpad alongside touch simultaneously. Both must work at the same time.
- Context menus: right-click (pointer) and long-press (touch).
- Drag interactions must have touch equivalents or alternative flows.

---

## Browser Testing

Target browsers: Chrome (desktop + Android), Safari/WebKit (iOS, iPadOS, macOS), Firefox (desktop).

WebKit differences to watch: backdrop-filter rendering, scrollbar styling, CSS animation performance, ScrollArea behavior, date input formatting. Verify new CSS features and animations work in WebKit.

---

## Performance Guardrails

- Animate only GPU-composited properties (transform, opacity). Never animate layout properties (width, height, top, left, margin, padding).
- CSS-first motion. Framer Motion only for springs, gestures, or layout animations.
- Self-host and preload all fonts. No CDN font dependency.
- Performance-adaptive: default to lower motion on underpowered devices. Always let user override via motion level.

---

## Design Reference

All visual decisions must align with [DESIGN.md](DESIGN.md) and the Design Philosophy Manifesto in Notion. Key specs: spacing on 8px base grid (4px half-step), Major Third type scale from 16px, border radii 6/8/12/16px (no sharp corners), four-level shadow system (warm-toned), motion timing by category. Three design principles: Calm, Crafted, Alive. Accent color usage is surgical — primary buttons, active nav, selected indicators, link text, focus rings. More accent ≠ better.

---

## Security Requirements

Every API route must:
- Validate the Supabase session and extract the user ID. No endpoint should trust client-provided user IDs.
- Scope all database queries to the authenticated user's ID. Never return or modify another user's data.
- Use parameterized queries (Drizzle handles this, but verify if writing raw SQL).
- Have a try/catch with Sentry.captureException for error tracking.

**Row Level Security (RLS):**
- All Supabase tables must have RLS enabled with policies that restrict access to the owning user.
- When adding new tables, always add RLS policies before the table is used.

**AI endpoint protection:**
- The `/api/ai/generate` endpoint uses the app's Gemini API key for free-tier users. Rate limiting must be enforced (check `ai_usage` table).
- User-provided API keys are encrypted with AES-256-GCM (`lib/encryption.ts`). Never log, expose, or return decrypted keys to the client.

**When adding new endpoints or tables:**
- Verify RLS policies cover the new table
- Verify the route handler validates auth
- Verify no data can be accessed or modified across user boundaries
- Check if the change introduces any new rate-limit-bypass vectors

**Security vs. local dev:** If a security fix would break local development or testing, flag it in the PR description with the tradeoff explained. Never silently break local dev for security. Common safe patterns:
- Rate limiting can be relaxed in `NODE_ENV=development`
- Supabase redirect URLs must include localhost for local OAuth
- Cookie secure flag should be false in development

SECURITY.md must never contain details of unfixed vulnerabilities. Report those directly in the session. Once fixed, document the resolved issue and the pattern to avoid.

---

## Observability

**Sentry:** Check the Sentry dashboard for unresolved errors before opening a PR. Fix errors caused by your changes. Resolve stale dev-build noise. When adding new components or API routes, add Sentry error boundaries or try/catch with `Sentry.captureException`.

**PostHog:** Every new user-facing action gets a `posthog.capture()` call (noun_verb format). Performance marks (`perf_note_switch`, `perf_app_ready`) should be forwarded to PostHog for real-user monitoring. All events must include relevant properties (`note_id`, `user_id`, `timestamp`).

When in doubt about whether something is tracked, check the PostHog section in this file for the baseline event list, and search the codebase for existing `posthog.capture` calls.

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

PostHog is used for analytics. Full event schema and instrumentation guide in [OBSERVABILITY.md](OBSERVABILITY.md).

Event naming: `noun_verb`. All events include `timestamp` and relevant IDs. Adding `posthog.capture()` for every new user-facing action is part of the Definition of Done. Requests are proxied through `/ingest/*` rewrites.

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

Branch strategy: `master` is production. `feature/*`, `fix/*`, `chore/*`, `refactor/*`, and `test/*` branches get Vercel preview deployments automatically.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| master | Production — Vercel deploys from here |
| feature/name | New feature work, branched from master |
| fix/name | Bug fixes, branched from master |
| chore/name | Docs, config, non-feature work |
| refactor/name | Restructuring code without changing behavior (e.g., the shadcn/ui migration) |
| test/name | Test-only changes (adding/updating Playwright specs without feature changes) |

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

Full testing guide in [TESTING.md](TESTING.md): how to run the suite, Playwright project configuration, CI pipeline, visual regression, and performance testing.

Quick start (requires dev server on port 3000):

```bash
pnpm --filter @workspace/next-app run test:e2e
```

All tests use demo mode — no credentials needed. 9 spec files (01–09) covering app load, notes, quick bits, vault, micro-interactions, templates, onboarding, performance, and visual regression. Use `data-testid` attributes for all selectors.

---

## Codebase Caveats

FontSize is a named export from `@tiptap/extension-text-style`. Do not install `@tiptap/extension-font-size` — it is deprecated.

AI provider keys are stored encrypted in the `user_api_keys` DB table. The encryption utility is in `lib/encryption.ts` (AES-256-GCM, imported via `@lib/encryption`). The active provider setting is in `user_settings`. Do not use localStorage for AI keys.

---

## Self-Maintenance

These documentation files are living documents. They must stay accurate as the codebase evolves.

**Before submitting every PR, check:**
1. If files were added, removed, or renamed → update the directory tree in [ARCHITECTURE.md](ARCHITECTURE.md)
2. If UI components were added or modified → verify they align with [DESIGN.md](DESIGN.md) and update it if new patterns were established
3. If new API endpoints or database tables were added → update [ARCHITECTURE.md](ARCHITECTURE.md)
4. If new environment variables were added → update `.env.example`
5. If performance-sensitive changes were made → run performance tests and update [PERFORMANCE.md](PERFORMANCE.md) baselines if they shifted intentionally
6. If any new features were added → add a [CHANGELOG.md](CHANGELOG.md) entry
7. If the change adds error handling or analytics → update [OBSERVABILITY.md](OBSERVABILITY.md)
8. If the change touches auth, encryption, RLS, or rate limiting → update [SECURITY.md](SECURITY.md)

**Token efficiency rule:** CLAUDE.md stays under 300 lines of substantive content. All detailed reference content belongs in the dedicated doc files. Do not add API lists, DB schemas, or event catalogs to CLAUDE.md.

**File storage rules:**
- All documentation files (.md) are committed to the repo and pushed to GitHub. They contain no secrets and are safe to be public.
- `.env`, auth state files, and anything with real credentials stays gitignored. Never commit secrets.
- Operational docs (active work tracking, decision log, rollback log) stay in Notion.
- If a security audit finds unfixed vulnerabilities, report findings in the session output only. Do not commit vulnerability details until the fix is merged. Then update SECURITY.md with the resolved issue.

---

## Future-Proofing

Before adding new features, be aware of these five architectural constraints. Full details in [ARCHITECTURE.md](ARCHITECTURE.md).

1. **Browser-only coupling** — Zustand store exposed on `window`, all preferences in `localStorage`, demo vault PIN in `sessionStorage`. A server-rendered or native port requires abstracting these.
2. **Editor content architecture** — `GrapheEditor` is shared between notes and quick bits; `EditorToolbar` is rich-text-specific. New content types (canvas, spreadsheet) need a toolbar abstraction, not just a new shell.
3. **Single-user assumptions** — no conflict resolution, no presence, preferences are client-only. Collaboration requires CRDTs, a sharing model, and server-authoritative preference sync.
4. **Network dependency** — authenticated mode fails hard without network; there is no offline queue. Demo mode is fully offline. Adding offline-capable auth requires local-first storage.
5. **Data layer portability** — Drizzle ORM is swappable; Supabase Auth is tightly coupled (JWKS endpoint, Admin API, session management). Replacing auth requires changes to middleware, `auth-server.ts`, and `auth/callback`.

---

## Working Convention

- Run routine commands (git status/log/diff/branch/add/commit/push, pnpm install/typecheck/build, chmod, mkdir, rm within the repo) without asking for permission.
- Only ask for confirmation before destructive or hard-to-reverse operations: force push, git reset --hard, deleting branches, dropping the database, or anything that affects shared/remote state beyond a normal commit+push.
- Only modify code files within the Graphe-Notes repository. Installing packages and running dev tools is fine. Never modify unrelated projects or system configuration files.
- Never delete files without explaining what and why. Wait for confirmation.
- Never commit directly to master. Always use a feature branch. One feature = one branch = one PR.
- When something goes wrong, stop immediately and explain before attempting a fix.
