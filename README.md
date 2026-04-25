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
