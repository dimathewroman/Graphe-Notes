# Workspace

## Overview

Full-stack notes app with a responsive React + Vite web frontend and Express API backend. Stores notes in PostgreSQL via Drizzle ORM. The web app is fully responsive across desktop (1024px+), tablet (768–1023px), and mobile (<768px).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase PostgreSQL + Drizzle ORM
- **Auth**: Supabase Auth (Google/Apple OAuth, email/password)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, TanStack Query
- **Rich text editor**: Tiptap (with Color, FontFamily, TextAlign, Highlight, Image, Underline, Placeholder)
- **State management**: Zustand
- **Animations**: Framer Motion
- **Responsive**: Custom useBreakpoint hook (mobile <768px, tablet 768-1023px, desktop 1024px+)

## Features

- Responsive layout: desktop 3-panel (sidebar/list/editor), tablet 2-panel (drawer sidebar + list/editor), mobile single-column (list/editor navigation)
- Rich text editing (bold, italic, underline, headings, lists, colors, fonts, images)
- Nested folder organization with colors and icons
- Pinning and favorites
- Multi-filter search (by text, folder, tag, pinned, favorite, sort)
- Tag system (notes have string array tags)
- AI assistant panel (supports OpenAI, Anthropic, Google Gemini — user provides API key, stored in localStorage)
- Auto-save with 800ms debounce
- Dark/light mode toggle
- Collapsible note list panel (toggle via toolbar button)
- Smart popup/menu positioning (viewport boundary clamping, sub-menu flipping)
- Swipeable toolbar with gradient fade scroll indicators
- Responsive AI selection toolbar (icon-only/stacked layout on mobile)
- Vault system: password-protected vault folder for sensitive notes (setup, unlock, lock, change password)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   ├── notes-app/          # React + Vite frontend
│   └── mockup-sandbox/      # Component preview sandbox
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **folders**: id, name, parentId, color, icon, sortOrder, createdAt, updatedAt
- **notes**: id, title, content (HTML), contentText (plain), folderId, tags (text[]), pinned, favorite, vaulted, coverImage, createdAt, updatedAt
- **vault_settings**: id, passwordHash, createdAt, updatedAt

## API Endpoints

All endpoints prefixed with `/api`:
- `GET/POST /folders`
- `PATCH/DELETE /folders/:id`
- `GET/POST /notes` (filters: folderId, search, pinned, favorite, tag, sortBy, sortDir)
- `GET/PATCH/DELETE /notes/:id`
- `PATCH /notes/:id/pin`
- `PATCH /notes/:id/favorite`
- `PATCH /notes/:id/move`
- `PATCH /notes/:id/vault` (body: { vaulted: boolean })
- `GET /tags`
- `GET /vault/status`
- `POST /vault/setup` (body: { passwordHash })
- `POST /vault/unlock` (body: { passwordHash })
- `POST /vault/change-password` (body: { currentPasswordHash, newPasswordHash })
- `POST /ai/complete` (provider: openai|anthropic|google, apiKey, model, prompt)
- `GET/POST /api/models` (GET for web backward compat, POST with body for mobile)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for validation and `@workspace/db` for persistence.

### `artifacts/notes-app` (`@workspace/notes-app`)

React + Vite frontend. Uses `@workspace/api-client-react` for type-safe API calls via React Query hooks.

Key components:
- `src/store.ts` — Zustand store (active filter, selected note, mobileView, sidebar state, vault unlock state)
- `src/hooks/use-mobile.tsx` — Responsive hooks: useIsMobile, useIsTablet, useBreakpoint, useKeyboardHeight
- `src/pages/Home.tsx` — Layout shell with breakpoint-conditional panel rendering and animated sidebar drawer
- `src/components/Sidebar.tsx` — Folder tree (SidebarContent extracted for drawer reuse)
- `src/components/NoteList.tsx` — Filtered note list with search, hamburger menu on mobile/tablet
- `src/components/NoteEditor.tsx` — Tiptap editor with mobile-native top bar (back/undo/redo/overflow), bottom keyboard-aware toolbar, expanded overflow menu (MoreVertical with Pin/Fav/Share/Vault/History/Find/Delete)
- `src/components/AIPanel.tsx` — AI assistant (full-screen on mobile, side panel on desktop)
- `src/components/SettingsModal.tsx` — Settings modal with Appearance, AI, Data, and Security tabs
- `src/components/VersionHistoryPanel.tsx` — Version history (full-width on mobile)
- `src/components/PinPad.tsx` — Reusable 6-digit PIN pad with 3x4 grid, dot indicators, backspace
- `src/components/VaultModal.tsx` — Vault setup/unlock/change-PIN modal using PinPad

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with Supabase PostgreSQL. Connection uses `SUPABASE_DB_URL` (session-mode pooler).

In development, use `pnpm --filter @workspace/db run push`, and fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Frontend auth hook using Supabase Auth. Exports `useAuth()` (user, isLoading, isAuthenticated, login, logout) and the `supabase` client instance. Supabase URL and anon key are injected via Vite `define` from `SUPABASE_URL` / `SUPABASE_ANON_KEY` env vars.

### Auth Architecture

- **Frontend**: `@workspace/replit-auth-web` creates a Supabase client with anon key, handles OAuth sign-in via `signInWithOAuth`, tracks session via `onAuthStateChange`, and sets the access token on `customFetch` via `setAccessToken()`.
- **Backend**: `authMiddleware` extracts Bearer token from Authorization header, validates via `supabaseAdmin.auth.getUser()`, upserts user into `users` table, and sets `req.user`.
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (frontend via Vite define), `SUPABASE_SERVICE_ROLE_KEY` (backend only), `SUPABASE_DB_URL` (backend DB connection).

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
