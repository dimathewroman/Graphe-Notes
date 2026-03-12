# Workspace

## Overview

Full-stack notes app with a React + Vite web frontend and Express API backend. Stores notes in PostgreSQL via Drizzle ORM.

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
│   └── notes-app/          # React + Vite frontend
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

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages.

Run codegen: `pnpm --filter @workspace/api-spec run codegen`
