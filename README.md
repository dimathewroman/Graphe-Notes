# Graphe Notes

A full-stack, self-hostable notes app with rich text editing, nested folders, tags, AI assistant, and a password-protected vault — built with Next.js, Vercel, and Supabase.

## Features

- Rich text editor (bold, italic, headings, lists, colors, fonts, images)
- Nested folder organization with colors and icons
- Pin, favorite, and tag notes
- Full-text + multi-filter search
- AI assistant panel (bring your own OpenAI, Anthropic, or Gemini key)
- Password-protected vault folder for sensitive notes
- Dark/light mode
- Responsive layout — desktop, tablet, and mobile

## Demo mode

The app runs fully in demo mode with no credentials required. You can create, edit, delete, pin, tag, and vault notes — everything works. Changes are stored in memory for the duration of your browser session and are lost if you refresh the page, close the tab, or sign in/sign up.

Click **"Try demo without signing in"** on the login screen to enter demo mode.

## Running locally

### Prerequisites

- [Node.js 24+](https://nodejs.org)
- [pnpm](https://pnpm.io) — `npm install -g pnpm`

### 1. Clone and install

```bash
git clone https://github.com/dimathewroman/Graphe-Notes.git
cd Graphe-Notes
pnpm install
```

### 2. Configure environment (optional — demo mode works without this)

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials. See [Environment variables](#environment-variables) below for where to find them.

### 3. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

All variables live in a single `.env` file at the repo root. The app ships with sensible placeholder defaults so demo mode works without any `.env`.

| Variable | Required for | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + real data (frontend) | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + real data (frontend) | Supabase dashboard → Project Settings → API |
| `SUPABASE_URL` | API routes | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes (admin ops) | Supabase dashboard → Project Settings → API |
| `SUPABASE_DB_URL` | Schema migrations | Supabase dashboard → Project Settings → Database → Connection string (Session mode) |
| `NEXT_PUBLIC_API_ORIGIN` | Static client only | The separately deployed HTTPS Graphe API origin; required for `pnpm run build:static-client` |
| `NEXT_PUBLIC_POSTHOG_INGEST_HOST` | Static client telemetry only | Optional direct HTTPS PostHog ingest endpoint; leave unset to disable static-bundle telemetry |

## Static client build target

`artifacts/next-app` remains the hosted web and `/api` owner. The separate
static-client target is a Capacitor-compatible web directory only: it contains
the browser UI and auth callback page, while all authenticated API requests use
the existing public API-origin seam.

With the hosted API origin supplied as a public build variable, run:

```bash
NEXT_PUBLIC_API_ORIGIN=https://api.example.com \
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key \
pnpm run build:static-client
```

The command first proves the static import graph excludes hosted route handlers,
middleware, database/service-role code, and server instrumentation. It then
emits `artifacts/static-client/out/`, including `index.html` and
`auth/callback.html`. Images are intentionally unoptimized; telemetry is off
unless `NEXT_PUBLIC_POSTHOG_INGEST_HOST` is explicitly provided. Static Sentry
reporting is also intentionally disabled until it has its own approved client
transport. It does not change hosted behavior, CORS origins, or native OAuth
handling.

## Capacitor mobile shell

Graphe Notes includes a source-controlled Capacitor v8 foundation for Android
phones/foldables and iPad. Its immutable native identity is
`com.leridian.graphe` / **Graphe Notes**, and it registers the `graphe` URL
scheme on both platforms. The shell always packages the reproducible static
bundle in `artifacts/static-client/out`; it has no live-reload `server.url`,
cleartext exception, or mixed-content configuration.

Use public, non-production values for a local static-bundle or native-build
check. These example values only exercise the build boundary and must never be
committed as deployment configuration:

```bash
export NEXT_PUBLIC_API_ORIGIN=https://api.example.com
export NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key

pnpm run check:capacitor-foundation
pnpm run build:mobile-web
pnpm run cap:sync
pnpm run android:build
pnpm run android:run
pnpm run ios:build
pnpm run ios:run
```

The iOS scripts select `/Applications/Xcode-beta.app` only for their own
command; they do not change the machine-wide Xcode selection. `@capacitor/app`
is included for lifecycle and URL-open bridge support, but this foundation does
not yet consume a deep link or complete OAuth. Native auth persistence, an
approved HTTPS API origin/CORS policy, and OAuth callback routing remain
separate decisions.

## Database setup

After filling in `SUPABASE_DB_URL`:

```bash
pnpm --filter @workspace/db run push
```

This applies the Drizzle schema to your Supabase project.

## Project structure

```
├── artifacts/
│   ├── next-app/        # Next.js 16 app — frontend + API routes (port 3000)
│   └── mockup-sandbox/  # Component preview sandbox
├── lib/
│   ├── api-spec/        # OpenAPI spec + Orval codegen config
│   ├── api-client-react/# Generated React Query hooks
│   ├── api-zod/         # Generated Zod schemas
│   └── db/              # Drizzle ORM schema + DB connection
└── .env.example         # Copy to .env and fill in credentials
```

## Tech stack

- **Frontend + Backend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query v5, Zustand, Framer Motion, Tiptap
- **Auth + DB**: Supabase (PostgreSQL, Auth)
- **ORM**: Drizzle ORM
- **Monorepo**: pnpm workspaces
- **Deployment**: Vercel
