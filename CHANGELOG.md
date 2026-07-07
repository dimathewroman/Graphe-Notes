# Changelog

All notable changes to Graphe Notes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Streaming AI responses** — AI toolbar actions now stream tokens into the editor progressively (SSE) instead of appearing all at once, for the free tier and every BYOK provider (`lib/ai-stream.ts`, `streamProviderDeltas` + per-adapter `streamDelta`/`streamUrl`/`streamBody`). Retry, cancel, and length-validation are preserved on the streaming path. A flag-gated (`NEXT_PUBLIC_ENABLE_DEMO_AI`, dev/CI only) mock streams deterministic tokens so the whole pipeline is exercisable in demo mode and e2e-tested.
- **Plug-and-play AI providers** — six OpenAI-compatible providers (OpenRouter, Groq, Mistral, Together, Fireworks, and a custom base-URL option) selectable in Settings → AI, backed by a single server-side adapter table (`lib/ai-providers.ts`). Adding a provider is one config record.
- **Model discovery** — the OpenAI-compatible and Anthropic settings forms auto-discover available models from the provider; local LLMs and custom endpoints discover client-side via `/v1/models`.
- **Self-healing free-tier model** — the free tier discovers the lightest available Gemini model from the ListModels API (cached, with fallback to the hardcoded constant) and re-discovers on a 404, so a retired model id no longer breaks free AI (`lib/gemini-model-discovery.ts`).
- **AI token accounting + per-action telemetry** — the generate route persists per-user `total_tokens_used` and tags every `ai_generate_completed` event with the originating action.

### Changed
- Consolidated all client AI requests through a single `executeAiRequest` path (`lib/execute-ai-request.ts`); the active-provider settings fetch is cached in React Query instead of refetched per action.
- **AI prompt contract v2** — task instructions moved to the provider **system role** with the user's selection fenced as data (resists prompt injection); AI actions now round-trip the selection as **HTML** so bold/links/lists and block separation survive; each action carries per-action **sampling settings** (mechanical actions near-deterministic, creative ones varied) and, for shorten/lengthen, the result length is validated with one corrective retry; actions **route by size** to the light vs primary model instead of always using the primary. Added a zod-validated structured-output scaffold (`lib/ai-suggestions.ts`) for future background suggestions.

### Security
- Added an SSRF guard (`lib/url-guard.ts`, `isSafeExternalUrl`) for user-supplied upstream URLs the server fetches. The custom OpenAI-compatible provider's base URL is validated at save time — loopback, private, link-local, and cloud-metadata addresses are rejected. Local-LLM and custom-endpoint model discovery run client-side, so no user-controlled URL reaches a server-side fetch.
- Added a server-side `AbortSignal.timeout` (30s) on all upstream AI provider calls so a hung provider returns a clean 504 instead of holding the serverless function open.

### Fixed
- **A missing free-tier server key no longer burns quota or shows a raw 500.** The free-tier path checked `GEMINI_API_KEY` *after* incrementing the user's hourly usage and `throw`ing on absence — so a server misconfiguration counted against the user's 5 free requests and surfaced "Something broke on our end." The key check now runs before the increment and returns a clear `free_unavailable` (503) — "Free AI is temporarily unavailable, add your own API key in Settings" — while still logging the misconfiguration to Sentry (`api/ai/generate`, `lib/ai-errors.ts`).
- **AI errors now tell the user why a request failed.** A shared error registry (`lib/ai-errors.ts`) maps every failure to one truthful, actionable message + severity, resolved from a stable code shared by the route and the client. Key fixes: a provider's **daily** quota is no longer mislabeled as a momentary per-minute limit (`lib/ai-error-handler.ts` now reads Gemini's `quotaId` + `RetryInfo` instead of string-matching a generic message — a daily cap said "busy, retrying in a moment" *forever*); an **expired session** reads as "refresh to sign back in" instead of "bad API key"; **streaming failures no longer fail silently** (a zero-token stream surfaces "the AI returned nothing"); **content-filter** refusals, **offline**, and **empty-selection** now have their own messages; and the client no longer **truncates messages at 120 chars** (which cut off the actionable half). Retry timing comes from the provider's `RetryInfo`, and only per-minute limits auto-retry — a daily cap never does.
- **AI actions no longer truncate on real notes.** Gemini 2.5 models bill their (default-on) thinking tokens against `maxOutputTokens`, so on a realistic note the model spent almost its entire 1024-token budget thinking and cut the actual answer off — silently mid-tag on the streaming path (users saw a fragment), and as `output_truncated` on the one-shot path. Thinking is now disabled for these mechanical text transforms (Flash/Flash-Lite budget 0; Pro floored at 128; omitted for non-2.5 models), and the output cap is raised from 1024 to 4096 for headroom (`lib/ai-providers.ts` `geminiThinkingBudget`/`geminiGenerationConfig`, `api/ai/generate`). Verified against a live key: all 20 AI actions now return complete output on a 200-word note.
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
