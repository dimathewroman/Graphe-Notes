# Architecture

Reference for the Graphe Notes codebase structure, data flow, and system design. Read this before adding endpoints, tables, or changing data-fetching patterns.

---

## Directory Tree

```
Graphe-Notes/
├── artifacts/
│   └── next-app/                    Next.js application (frontend + API)
│       ├── src/
│       │   ├── app/
│       │   │   ├── api/             Route handlers (see API Endpoints below)
│       │   │   ├── auth/callback/   OAuth redirect handler
│       │   │   ├── globals.css      Design tokens, color modes, motion tokens
│       │   │   ├── layout.tsx       Root layout (Providers, fonts, Sentry)
│       │   │   └── page.tsx         Single-page app entry point
│       │   ├── components/
│       │   │   ├── editor/          Tiptap editor sub-components (includes ToolbarButton.tsx)
│       │   │   ├── templates/       Template picker + save-as-template dialogs
│       │   │   ├── ui/              shadcn/ui components + custom wrappers (IconButton.tsx lives here)
│       │   │   ├── AIPanel.tsx
│       │   │   ├── AISetupModal.tsx
│       │   │   ├── AllAttachments.tsx
│       │   │   ├── FolderEditModal.tsx
│       │   │   ├── Home.tsx         Main layout orchestrator
│       │   │   ├── NoteList.tsx
│       │   │   ├── NoteShell.tsx    Note orchestrator (~910 lines)
│       │   │   ├── PostHogProvider.tsx
│       │   │   ├── Providers.tsx    All context providers
│       │   │   ├── QuickBitList.tsx
│       │   │   ├── QuickBitShell.tsx
│       │   │   ├── RecentlyDeleted.tsx
│       │   │   ├── SettingsModal.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── VaultModal.tsx
│       │   │   └── VersionHistoryPanel.tsx
│       │   ├── hooks/               Custom React hooks
│       │   ├── lib/                 Auth, Supabase clients, AI prompts, demo data
│       │   ├── middleware.ts        JWT validation for all /api/* routes
│       │   ├── store.ts             Zustand store
│       │   └── types/               TypeScript declarations
│       ├── e2e/                     Playwright test suites
│       ├── next.config.ts           CSP headers, Sentry plugin, PostHog rewrites
│       ├── playwright.config.ts
│       ├── sentry.client.config.ts
│       ├── sentry.server.config.ts
│       └── sentry.edge.config.ts
├── lib/
│   ├── api-spec/                    OpenAPI spec (openapi.yaml) + Orval config
│   ├── api-client-react/            Generated React Query hooks + custom fetch
│   ├── api-zod/                     Generated Zod schemas
│   ├── db/                          Drizzle ORM schema + DB connection + migrations
│   ├── ai-error-handler.ts
│   ├── ai-model-router.ts
│   ├── ai-rate-limit.ts
│   └── encryption.ts               AES-256-GCM for AI provider keys
├── scripts/
│   ├── post-merge.sh               pnpm install + db push after merge/pull
│   ├── pre-push.sh                 typecheck before every push
│   └── seed-templates.ts           Seeds preset templates into DB
├── .github/workflows/e2e.yml       CI pipeline
├── CLAUDE.md
├── ARCHITECTURE.md (this file)
├── DESIGN.md
├── PERFORMANCE.md
├── TESTING.md
├── SECURITY.md
├── OBSERVABILITY.md
└── CONTRIBUTING.md
```

---

## Application Routing

### Pages

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Single-page app — renders `<Home />` after auth check |
| `/auth/callback` | `app/auth/callback/page.tsx` | OAuth redirect handler; listens for `onAuthStateChange`, redirects to `/` |

The app is a single-page application. All navigation (notes, folders, quick bits, settings) is state-driven inside `Home.tsx` — no additional Next.js page routes.

### API Endpoints

All handlers live in `artifacts/next-app/src/app/api/` and are prefixed `/api`.

**Notes**
- `GET /notes` — list (filters: folderId, search, pinned, favorite, tag, sortBy, sortDir)
- `POST /notes` — create
- `GET /notes/:id` — fetch single note with full HTML content
- `PATCH /notes/:id` — update title, content, tags, folderId
- `PATCH /notes/:id/pin`
- `PATCH /notes/:id/favorite`
- `PATCH /notes/:id/move`
- `PATCH /notes/:id/vault`
- `POST /notes/:id/delete` — soft-delete (sets `deletedAt`)
- `POST /notes/:id/restore`
- `DELETE /notes/:id/permanent`
- `GET /notes/:id/versions`
- `GET /notes/:id/versions/:versionId`
- `DELETE /notes/:id/versions/:versionId`
- `POST /notes/:id/versions/:versionId/restore`

**Folders**
- `GET /folders`, `POST /folders`
- `PATCH /folders/:id`, `DELETE /folders/:id`

**Quick Bits**
- `GET /quick-bits`, `POST /quick-bits`
- `GET /quick-bits/:id`, `PATCH /quick-bits/:id`, `DELETE /quick-bits/:id`
- `DELETE /quick-bits/:id/soft-delete`
- `GET /quick-bits/settings`, `PATCH /quick-bits/settings`
- `DELETE /quick-bits/expired`

**Templates**
- `GET /templates`, `POST /templates`
- `PATCH /templates/:id`, `DELETE /templates/:id`

**Attachments**
- `POST /attachments/upload`
- `GET /attachments/all`
- `GET /attachments/note/:noteId`
- `GET /attachments/:attachmentId`, `DELETE /attachments/:attachmentId`

**Vault**
- `GET /vault/status`
- `POST /vault/setup`
- `POST /vault/unlock`
- `POST /vault/change-password`

**AI**
- `POST /ai/generate`
- `GET /ai/keys`, `POST /ai/keys`, `PATCH /ai/keys`, `DELETE /ai/keys`
- `GET /ai/settings`, `PATCH /ai/settings`
- `GET /ai/usage`
- `POST /ai/models`

**Other**
- `GET /tags`
- `GET /smart-folders`, `POST /smart-folders`
- `PATCH /smart-folders/:id`, `DELETE /smart-folders/:id`
- `GET /healthz`
- `POST /cron/purge-deleted` — Vercel cron, daily 3 AM UTC

---

## Authentication

Authentication is a two-layer system.

### Layer 1: JWT middleware (module-level gate)

`artifacts/next-app/src/middleware.ts` intercepts all `/api/*` requests before they reach any handler.

- Uses `jose` + `createRemoteJWKSet` to validate JWTs against Supabase's JWKS endpoint
- Rejects requests with invalid or missing tokens with `401` before any handler code runs
- **Exemptions**: `/api/healthz` (no auth required) and `/api/cron/*` (uses `CRON_SECRET` header instead)
- This is a defense-in-depth layer — it does not extract user data, only validates the token signature

### Layer 2: Per-route user resolution

`artifacts/next-app/src/lib/auth-server.ts` is called inside every handler via `getAuthUser(request)`.

**Flow:**
1. Extract Bearer token from `Authorization` header
2. Check 60-second LRU cache (max 100 entries, keyed by token)
3. On cache miss: call `supabaseAdmin.auth.getUser(token)` (Supabase Admin API)
4. On success: fire-and-forget upsert of user into `users` table; cache result for 60s
5. Return `{ user }` — the handler uses `user.id` for all DB queries

**Token invalidation latency:** Up to 60 seconds. A revoked token can still pass for up to one cache TTL.

### OAuth flow

`/auth/callback/page.tsx` listens for `supabase.auth.onAuthStateChange`. On `SIGNED_IN`, it reads the session and redirects to `/`. `TokenSync` (rendered in `Providers.tsx`) calls `supabase.auth.setSession()` when the auth state changes, keeping the client-side Supabase client in sync.

---

## Database Schema

13 tables in `public` schema. All defined in `lib/db/src/schema/`.

### Tables

**users** — user identity and entitlements
| Column | Type | Notes |
|---|---|---|
| id | text PK | Supabase auth.uid() |
| email | text | |
| firstName | text | |
| lastName | text | |
| profileImageUrl | text | |
| storageTier | text | default 'free'; UPDATE policy prevents self-promotion |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**folders** — user-created folder hierarchy
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| name | text |
| parentId | uuid nullable |
| color | text |
| icon | text |
| tagRules | text[] |
| sortOrder | int |
| createdAt / updatedAt | timestamp |

**notes** — rich-text notes with soft-delete
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | text FK → users | |
| title | text | |
| content | text | Full HTML from Tiptap |
| contentText | text | Plain-text preview (for list display and search) |
| folderId | uuid nullable | |
| tags | text[] | |
| pinned | boolean | |
| favorite | boolean | |
| vaulted | boolean | |
| coverImage | text | |
| deletedAt | timestamp | Set on soft-delete; null = active |
| autoDeleteAt | timestamp | Set 30 days after soft-delete |
| deletedReason | text | |
| createdAt / updatedAt | timestamp | |

**note_versions** — version history snapshots
| Column | Type |
|---|---|
| id | uuid PK |
| noteId | uuid FK → notes |
| userId | text FK → users |
| title | text |
| content | text |
| contentText | text |
| label | text |
| source | text |
| createdAt | timestamp |

**vault_settings** — per-user vault PIN
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| passwordHash | text | bcrypt 12 rounds |
| createdAt / updatedAt | timestamp |

**templates** — preset and user-created note templates
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| name | text |
| description | text |
| category | text | capture / plan / reflect / create / mine |
| content | jsonb | Tiptap JSON content |
| isPreset | boolean |
| createdAt / updatedAt | timestamp |

**attachments** — files attached to notes
| Column | Type |
|---|---|
| id | uuid PK |
| noteId | uuid FK → notes |
| userId | text FK → users |
| fileName | text |
| fileType | text |
| fileSize | int |
| storagePath | text |
| displayMode | text |
| createdAt / deletedAt | timestamp |

**quick_bits** — ephemeral short-lived notes
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| title | text |
| content | text |
| contentText | text |
| expiresAt | timestamp |
| notificationHours | int[] |
| createdAt / updatedAt | timestamp |

**quick_bit_settings** — per-user quick bit defaults
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| defaultExpirationDays | int |
| defaultNotificationHours | int[] |
| createdAt / updatedAt | timestamp |

**smart_folders** — tag-rule-based virtual folders
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| name | text |
| tagRules | text[] |
| color | text |
| sortOrder | int |
| createdAt / updatedAt | timestamp |

**user_api_keys** — encrypted third-party AI keys
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| userId | text FK → users | |
| provider | text | google_ai_studio / openai / anthropic |
| encryptedKey | text | AES-256-GCM; see `lib/encryption.ts` |
| endpointUrl | text | For local LLM |
| modelOverride | text | |
| createdAt / updatedAt | timestamp | |

**user_settings** — user AI and setup preferences
| Column | Type | Notes |
|---|---|---|
| userId | text PK FK → users | |
| activeAiProvider | text | |
| hasCompletedAiSetup | boolean | |
| updatedAt | timestamp | |

> **Note:** Motion level, dark mode level, colorblind mode, accent color, and onboarding state are **not** stored here. They live in `localStorage` (keys: `motion_level`, `dark_mode_level`, `colorblind_mode`, `theme_mode`, `theme_accent`).

**ai_usage** — AI free-tier quota tracking
| Column | Type |
|---|---|
| id | uuid PK |
| userId | text FK → users |
| requestsThisHour | int |
| hourWindowStart | timestamp |
| requestsThisMonth | int |
| monthWindowStart | timestamp |
| totalTokensUsed | bigint |
| lastRequestAt | timestamp |
| createdAt | timestamp |

### Row Level Security

RLS is enabled on all 13 tables. Policies restrict access to the owning user (`user_id = auth.uid()::text`). The `templates` table SELECT policy additionally allows reading preset rows (`is_preset = true`). The `users` table UPDATE policy prevents `storage_tier` self-promotion.

Route handlers use the service role key which bypasses RLS — RLS is a defense-in-depth layer for direct PostgREST access. Migrations:
- `lib/db/drizzle/0000_*` — initial schema
- `lib/db/drizzle/0001_*` — RLS policies for 12 tables
- `lib/db/drizzle/0002_*` — note_versions user_id backfill
- `lib/db/drizzle/0003_templates_rls_policies.sql` — RLS policies for templates table

---

## Component Hierarchy

```
layout.tsx
└── Providers.tsx
    ├── TanStack QueryClientProvider
    ├── PostHogProvider
    ├── DemoContext (demo mode state)
    ├── Toaster (Sonner)
    ├── TokenSync (keeps Supabase client session in sync)
    └── Home.tsx  ─────────────────────────── main layout
        ├── Sidebar.tsx
        │   ├── Navigation (All Notes, Quick Bits, Recently Deleted, All Attachments)
        │   ├── Folder list (FolderEditModal)
        │   ├── Smart folder list
        │   └── Quick Settings (motion, dark mode, colorblind)
        ├── NoteList.tsx / QuickBitList.tsx /
        │   RecentlyDeleted.tsx / AllAttachments.tsx
        │   (rendered based on activeFilter in Zustand store)
        ├── NoteShell.tsx  ─────────────────── note orchestrator
        │   ├── NoteHeader.tsx (save status, actions, export/overflow menus)
        │   ├── NoteBody.tsx (title input, tags, editor wrapper)
        │   ├── EditorToolbar.tsx
        │   │   ├── FontPickerDropdown
        │   │   ├── FontSizeWidget
        │   │   ├── ColorPickerDropdown
        │   │   ├── LinkPopover
        │   │   ├── WordCountPopover
        │   │   ├── ExportMenu
        │   │   └── OverflowMenu
        │   ├── GrapheEditor.tsx  ────────────── Tiptap instance (shared)
        │   │   ├── SlashCommandMenu.tsx
        │   │   ├── AiSelectionMenu.tsx / MobileSelectionMenu.tsx
        │   │   ├── FindReplace.tsx
        │   │   └── TableOfContents.tsx
        │   ├── AttachmentPanel.tsx
        │   └── VersionHistoryPanel.tsx
        └── QuickBitShell.tsx  ──────────────── quick bit orchestrator
            └── GrapheEditor.tsx  (same component instance pattern)

Overlay components (rendered at app root, portal into body):
├── SettingsModal.tsx
├── AISetupModal.tsx
├── AIPanel.tsx
├── VaultModal.tsx
├── FolderEditModal.tsx
└── templates/TemplatePickerModal.tsx
    templates/SaveAsTemplateDialog.tsx
```

`GrapheEditor.tsx` is shared between `NoteShell` and `QuickBitShell`. It is never unmounted and remounted on content switch — content is updated via `editor.commands.setContent()`.

---

## State Management

Two state layers, with a strict separation of concerns.

### Zustand (client state)

`artifacts/next-app/src/store.ts`. All UI state that does not live on the server:

| State | Type | Purpose |
|---|---|---|
| activeFilter | string | Which list view is showing (all-notes, quick-bits, etc.) |
| activeFolderId | string \| null | Currently selected folder |
| activeTag | string \| null | Currently selected tag filter |
| searchQuery | string | Live search input |
| sort / sortDir | string | Sort field and direction |
| viewMode | string | List or grid |
| motionLevel | string | full / reduced / minimal |
| darkModeLevel | string | soft / default / oled |
| colorblindMode | string | none / protanopia / tritanopia |
| selectedNoteId | string \| null | Currently open note |
| selectedQuickBitId | string \| null | Currently open quick bit |
| mobileView | string | Which panel is visible on mobile |
| Panel open states | boolean | Version history, AI panel, settings, etc. |
| Panel widths | number | Draggable divider positions |
| vaultUnlocked | boolean | Whether vault PIN has been entered |
| AI setup state | object | Setup modal step, provider selection |
| Template picker state | object | Open state + context (note/quickbit) |
| Demo mode note IDs | string[] | IDs of demo-seeded notes for E2E |

The store is exposed on `window.__ZUSTAND_STORE__` in non-production environments for Playwright E2E test access.

### TanStack Query (server state)

All data from the API (notes, folders, tags, vault status, templates, attachments, quick bits) lives in the React Query cache. Generated hooks in `@workspace/api-client-react` are the only way to fetch or mutate server data.

Cache key helpers: `getGetNotesQueryKey()`, `getGetNoteQueryKey(id)`, etc. — use these for optimistic updates via `queryClient.setQueryData()`.

### localStorage (persisted preferences)

Keys: `motion_level`, `dark_mode_level`, `colorblind_mode`, `theme_mode`, `theme_accent`.

These are synced to Zustand on mount by `useMotionInit()` and `useAtmosphere()` hooks. They are **not** stored in the database.

---

## Data Fetching

### Generated hooks

All API access goes through generated React Query hooks in `@workspace/api-client-react`. Never write raw fetch calls for application data.

```
lib/api-spec/openapi.yaml  →  pnpm codegen  →  lib/api-client-react/  (hooks)
                                              →  lib/api-zod/           (schemas)
```

To add an endpoint: edit `openapi.yaml` → run `pnpm --filter @workspace/api-spec run codegen` → import the generated hook.

### Custom fetch

The generated hooks use a custom fetch function that automatically attaches the Bearer token from the Supabase session. In development, requests resolve to `http://localhost:3000/api/`.

### Optimistic updates

For mutations that update a known record (pin, favorite, tag, vault), use `queryClient.setQueryData()` to patch the cache immediately instead of `queryClient.invalidateQueries()`, which triggers a full network round-trip and list re-render. See PERFORMANCE.md for the pattern.

---

## Demo Mode

Demo mode is a zero-auth path through the full app.

`DemoContext` (`artifacts/next-app/src/lib/demo-context.tsx`) provides a `isDemoMode` boolean. When true:

- No API calls are made to authenticated endpoints
- Static demo data from `src/lib/demo-data.ts` is seeded directly into the TanStack Query cache on mode entry
- All mutations (`queryClient.setQueryData()`) patch the cache in-memory — no persistence
- Vault PIN is stored in `sessionStorage` under the key `"demo_vault_hash"`

Demo mode is entered via the "Enter demo mode" button on the login screen. It is exited by refreshing or signing in.

---

## Third-Party Dependencies

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Auth (Google/Apple OAuth, email/password). PostgREST is NOT used for data queries. |
| `drizzle-orm` | Type-safe SQL queries against Supabase PostgreSQL |
| `@tiptap/*` | Rich text editor (extensions: StarterKit, Table, Math, Image, TaskList, SlashCommand, etc.) |
| `framer-motion` | Gesture-driven and spring animations; layout animations |
| `@tanstack/react-query` v5 | Server state, cache management |
| `zustand` | Client UI state |
| `@sentry/nextjs` v10 | Error tracking (client + server + edge) |
| `posthog-js` / `posthog-node` | Product analytics |
| `jose` | JWT validation in middleware (JWKS) |
| `bcryptjs` | Vault PIN hashing (12 rounds) |
| `html2pdf.js` | PDF export |
| `turndown` + `turndown-plugin-gfm` | HTML → Markdown export |
| `diff-match-patch` | Version history diff computation |
| `katex` | Math rendering |
| `lowlight` | Code block syntax highlighting |
| `geist` | Geist Sans font (self-hosted via npm package) |
| `radix-ui` | Accessible headless UI primitives |
| `sonner` | Toast notifications |
| `vaul` | Drawer component |
| `next-themes` | Theme persistence |
| `orval` | OpenAPI → React Query + Zod codegen |

---

## Future Architecture Considerations

These are not bugs or technical debt — they are intentional design tradeoffs that have implications for any future evolution of the product.

### 1. Browser-only coupling

Several subsystems assume a browser runtime:

- **`window.__ZUSTAND_STORE__`** — exposed for Playwright E2E access. Guard with `typeof window !== 'undefined'` if server-rendering store state becomes necessary.
- **`localStorage`** — all user preferences (motion, dark mode, colorblind, accent, theme) are browser-only. A preferences sync to the server would require adding columns to `user_settings` and a migration path from localStorage.
- **`sessionStorage`** — demo vault PIN. Safe for browser but not available in any SSR context.
- **`window.location`** and Next.js App Router — routing is web-only. A React Native or Electron port would require abstracting the navigation layer.

### 2. Editor content architecture

`GrapheEditor.tsx` is the shared Tiptap instance. Its toolbar (`EditorToolbar.tsx`) is hardcoded for rich-text content. The current shell/chrome/content separation is:

- **NoteShell** = orchestrator (title, tags, save, versions, vault) — note-specific
- **GrapheEditor** = content renderer — content-type-agnostic
- **EditorToolbar** = rich-text-specific chrome

A new content type (canvas, spreadsheet, code-only) would need a new shell or a toolbar abstraction that swaps based on content type. The `NoteBody.tsx` and `AttachmentPanel.tsx` assume rich text content structure. The Tiptap extensions themselves are all loaded for every note regardless of content type — lazy extension loading would be needed at scale.

### 3. Single-user data assumptions

The data model makes no provision for multi-user scenarios:

- Version history is snapshot-based with no conflict resolution
- Notes have a single `userId` owner — no sharing or permissions model
- Preferences are stored per-user in localStorage — no cross-device sync
- No presence awareness (who else is viewing a note)

Collaboration would require operational transforms or CRDTs, a presence layer, and a sharing/permissions model layered onto the existing RLS policies.

### 4. Network dependency

Authenticated mode has no offline capability:

- TanStack Query cache provides brief resilience (data stays visible until cache expiry), but mutations fail immediately without network
- No offline queue, no optimistic persistence beyond in-memory cache
- Demo mode is fully offline — it never calls the API

An offline-capable authenticated mode would require a local-first storage layer (e.g. IndexedDB via Dexie) with a sync queue, plus conflict resolution for concurrent edits.

### 5. Data layer portability

The data layer has partial portability:

- **Drizzle ORM** abstracts the SQL layer — the DB could be swapped (e.g. to PlanetScale, Neon, or self-hosted Postgres) by changing the connection string
- **Supabase Auth** is tightly coupled — `getAuthUser()` calls `supabaseAdmin.auth.getUser()`, middleware validates against the Supabase JWKS endpoint, and the OAuth callback uses `@supabase/supabase-js` session management. Replacing auth would require reimplementing these three layers
- **PostgREST** (Supabase's auto-generated REST API) is NOT used — all data access goes through Drizzle route handlers, so the PostgREST layer can be disabled without impact
