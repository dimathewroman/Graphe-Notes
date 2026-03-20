# Graphe Notes

A full-stack, self-hostable notes app with rich text editing, nested folders, tags, AI assistant, and a password-protected vault — built with React, Vite, Express, and Supabase.

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

### 3. Start the dev servers

```bash
pnpm dev
```

This starts both the frontend (port 5173) and the API server (port 3001) in parallel.

Open [http://localhost:5173](http://localhost:5173).

## Environment variables

All variables live in a single `.env` file at the repo root. The app ships with sensible placeholder defaults so demo mode works without any `.env`.

| Variable | Required for | Where to find it |
|---|---|---|
| `SUPABASE_URL` | Auth + real data | Supabase dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | Auth + real data | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | API server (admin ops) | Supabase dashboard → Project Settings → API |
| `SUPABASE_DB_URL` | Schema migrations | Supabase dashboard → Project Settings → Database → Connection string (Session mode) |
| `PORT` | Frontend | Defaults to `5173` |
| `API_PORT` | API server | Defaults to `3001` |
| `BASE_PATH` | Frontend | Defaults to `/` |

## Database setup

After filling in `SUPABASE_DB_URL`:

```bash
pnpm --filter @workspace/db run push
```

This applies the Drizzle schema to your Supabase project.

## Project structure

```
├── artifacts/
│   ├── notes-app/       # React + Vite frontend (port 5173)
│   └── api-server/      # Express API server (port 3001)
├── lib/
│   ├── api-spec/        # OpenAPI spec + Orval codegen config
│   ├── api-client-react/# Generated React Query hooks
│   ├── api-zod/         # Generated Zod schemas
│   └── db/              # Drizzle ORM schema + DB connection
└── .env.example         # Copy to .env and fill in credentials
```

## Tech stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, TanStack Query v5, Zustand, Framer Motion, Tiptap
- **Backend**: Express 5, TypeScript, Drizzle ORM
- **Auth + DB**: Supabase (PostgreSQL, Auth)
- **Monorepo**: pnpm workspaces
