# Workspace

## Overview

Full-stack notes app with a React + Vite web frontend, Express API backend, and React Native (Expo) mobile app. Stores notes in PostgreSQL via Drizzle ORM.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS, TanStack Query
- **Rich text editor**: Tiptap (with Color, FontFamily, TextAlign, Highlight, Image, Underline, Placeholder)
- **State management**: Zustand
- **Animations**: Framer Motion
- **Mobile**: Expo (SDK 54), NativeWind v4, expo-router, React Native WebView (contentEditable rich text editor)
- **Mobile state**: TanStack React Query (shared with web via API), AsyncStorage-based offline cache
- **Mobile AI**: AIAssistant component with quick actions and custom prompts, integrated into note editor

## Features

- Three-panel layout: sidebar / note list / rich text editor
- Rich text editing (bold, italic, underline, headings, lists, colors, fonts, images)
- Nested folder organization with colors and icons
- Pinning and favorites
- Multi-filter search (by text, folder, tag, pinned, favorite, sort)
- Tag system (notes have string array tags)
- AI assistant panel (supports OpenAI, Anthropic, Google Gemini — user provides API key, stored in localStorage)
- Auto-save with 800ms debounce
- Dark/light mode toggle

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   ├── notes-app/          # React + Vite frontend
│   └── mobile/             # React Native (Expo) mobile app
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
- **notes**: id, title, content (HTML), contentText (plain), folderId, tags (text[]), pinned, favorite, coverImage, createdAt, updatedAt

## API Endpoints

All endpoints prefixed with `/api`:
- `GET/POST /folders`
- `PATCH/DELETE /folders/:id`
- `GET/POST /notes` (filters: folderId, search, pinned, favorite, tag, sortBy, sortDir)
- `GET/PATCH/DELETE /notes/:id`
- `PATCH /notes/:id/pin`
- `PATCH /notes/:id/favorite`
- `PATCH /notes/:id/move`
- `GET /tags`
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
- `src/store.ts` — Zustand store (active filter, selected note, UI state)
- `src/components/Sidebar.tsx` — Folder tree, navigation sections
- `src/components/NoteList.tsx` — Filtered note list with search
- `src/components/NoteEditor.tsx` — Tiptap rich text editor with auto-save
- `src/components/AIPanel.tsx` — AI assistant slide-out panel
- `src/components/SettingsModal.tsx` — Settings and export options

### `artifacts/mobile` (`@workspace/mobile`)

React Native (Expo) cross-platform notes app. Uses NativeWind for styling, expo-router for navigation, and TanStack Query for API data.

Key files:
- `app/_layout.tsx` — Root layout with providers (QueryClient, Theme, GestureHandler, Keyboard)
- `app/(tabs)/index.tsx` — Notes list with search, sort, list/gallery toggle, offline cache fallback, favorite/pinned filtering
- `app/(tabs)/folders.tsx` — Folder management with Quick Access (All Notes, Favorites, Pinned), Smart Folders, nested folder tree with CRUD
- `app/(tabs)/settings.tsx` — Theme, accent color, AI assistant configuration (provider, API key, model selection)
- `app/note/[id].tsx` — Note editor with rich text, toolbar, tags, version history (preview/delete/restore), lock/unlock, AI assistant
- `lib/api.ts` — API client wrapping all backend endpoints
- `lib/cache.ts` — SQLite-backed offline cache (native) with AsyncStorage for settings
- `lib/database.ts` — Web fallback (in-memory store) for offline cache
- `lib/database.native.ts` — Native SQLite offline storage (expo-sqlite) with write queue and sync meta
- `contexts/ThemeContext.tsx` — Dark/light/system theme with AsyncStorage persistence
- `components/RichTextEditor.tsx` — Rich text editor using @10play/tentap-editor with bridge extensions
- `components/AIAssistant.tsx` — AI assistant bottom sheet with quick actions, custom prompts, settings integration
- `components/NoteCard.tsx` — Note card component

Architecture decisions:
- **Rich text editor**: Uses `@10play/tentap-editor` with `useEditorBridge` hook and bridge extensions (bold, italic, underline, tasklist, link, color, highlight, placeholder, image). Exposes a ref interface for getHTML/getText/setContent/insertText/focus.
- **Offline cache**: Platform-specific approach — `database.native.ts` uses expo-sqlite with full schema (notes, folders, smart_folders, write_queue, sync_meta tables). `database.ts` provides an in-memory fallback for web. The `cache.ts` layer wraps both with a unified API. AsyncStorage is reserved for user settings only.
- **AI configuration**: Provider/API key/model stored via AsyncStorage settings store. Settings screen supports Anthropic, OpenAI, Google providers with live model fetching from the API server.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
