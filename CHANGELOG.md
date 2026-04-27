# Changelog

All notable changes to Graphe Notes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Fixed
- Added `try/catch` + `Sentry.captureException` to all ~37 API route handlers that previously had no error tracking. Unhandled DB or Zod errors now surface in Sentry instead of returning silent 500s.
- Replaced four `rounded-[10px]` arbitrary values in `NoteList.tsx` and `QuickBitList.tsx` with `rounded-xl` (12px design token).
- Replaced all hardcoded Framer Motion durations with `useAnimationConfig()` tokens across `AIPanel`, `AISetupModal`, `SettingsModal`, `VaultModal`, `NoteShell`, `QuickBitShell`, `PinPad`, `NoteList`, `QuickBitList`, `TagRow`, `SlashCommandMenu`, `SaveAsTemplateDialog`, and `TemplatePickerModal`. Motion-level system now fully respected.
- Removed duplicate `posthog.capture("motion_level_changed")` call from `SettingsModal.tsx`. Event now fires exactly once via `useSetMotionLevel()` in `hooks/use-motion.ts`.
- Renamed PostHog event `quickbit_created_from_template` → `quick_bit_created_from_template` to match `noun_verb` convention.
- Forwarded perf markers `perf_editor_init`, `perf_note_switch`, and `perf_app_ready` to PostHog in production builds (gated on `NODE_ENV !== "development"`).
- Added `aria-label="Open settings"` to the settings button in `Sidebar.tsx`.

---

## [0.1.0] — 2026-04-26

Initial full-stack release. Covers the complete build period through April 2026.

### Added

**Core note-taking**
- Rich text editor (Tiptap 3) with headings, bold/italic/underline/strikethrough, lists (ordered, unordered, task), blockquotes, inline code, code blocks with syntax highlighting (lowlight), tables, images, horizontal rules, links, math (KaTeX), collapsible detail blocks, find/replace
- Note creation, editing, pinning, favoriting, moving between folders, soft-delete with 30-day auto-purge
- Note metadata: title, tags, cover image
- Version history — automatic snapshots on save; manual restore; version labels; diff view
- Full-text search across notes

**Organization**
- Folder hierarchy with color and icon customization, nested folders, tag rules for auto-population
- Smart folders — virtual folders that match notes by tag rules
- Tags — applied to notes; browseable from sidebar
- All Attachments view — browse all uploaded files across all notes
- Recently Deleted — soft-deleted note recovery

**Quick Bits**
- Ephemeral notes with expiration date and notification schedule
- Promote to full note
- Per-user default expiration and notification settings

**Vault**
- PIN-protected note vault; bcrypt 12-round hashing; transparent legacy SHA-256 migration
- In-memory rate limiting (5 attempts / 15 min for unlock; 3 / 1 hour for setup)
- Per-session vault unlock (lock resets on page reload)

**Templates**
- Preset templates (capture, plan, reflect, create categories)
- Save current note or quick bit as personal template
- Template picker modal with category filtering

**AI features**
- AI text generation via toolbar selection menu and inline AI panel
- Provider support: Graphe free tier (Gemini via server), Google AI Studio (user key), OpenAI (user key), Anthropic (user key), local LLM (client-side only)
- Free-tier rate limiting: 5 requests/hour per user, 100k/month global circuit breaker
- AI key encryption: AES-256-GCM; keys never returned to client
- First-time AI setup modal with provider selection and key entry
- AI model router: taskType → model selection (background/manual/deliberate)

**Authentication**
- Google OAuth, Apple OAuth, email/password via Supabase Auth
- Two-layer auth: JWT middleware (JWKS validation) + per-route `getAuthUser()` with 60s LRU cache
- Demo mode — full app experience with no sign-in, no API calls, data seeded in React Query cache

**Onboarding**
- 4-step first-run onboarding flow for authenticated and demo users
- Onboarding completion tracked in `user_settings`; demo mode uses sessionStorage

**UI and design system**
- Three-panel desktop layout (sidebar / note list / editor) with draggable dividers
- Mobile single-panel with drawer sidebar
- Dark default, soft dark, OLED dark, and light modes
- Three motion levels: full, reduced, minimal
- Colorblind modes: protanopia/deuteranopia and tritanopia
- shadcn/ui (new-york style) component library; custom IconButton, ToolbarButton wrappers
- Framer Motion spring animations; CSS motion tokens; `useAnimationConfig()` hook
- Responsive breakpoints: 344px (Galaxy Fold) through 1920px desktop

**Infrastructure**
- Next.js 16 App Router, React 19
- Supabase PostgreSQL + Drizzle ORM 0.45; Row Level Security on all 13 tables
- pnpm workspaces monorepo: next-app, api-spec, api-client-react, api-zod, db, scripts
- Orval codegen from OpenAPI spec to React Query hooks + Zod schemas
- Vercel deployment; Vercel cron for daily soft-delete purge
- Sentry 10 error tracking (client + server + edge)
- PostHog analytics (client + server); event schema with 50+ instrumented events
- Playwright E2E suite (9 spec files); performance baseline tracking; visual regression testing
- GitHub Actions CI: parallel typecheck + E2E jobs; perf PR comment; artifact upload
