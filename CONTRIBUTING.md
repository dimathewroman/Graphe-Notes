# Contributing

This document covers how to set up a local development environment and the workflow for making changes to Graphe Notes.

---

## Prerequisites

- **Node.js** 20+ (Node 24 recommended)
- **pnpm** 10 — `npm install -g pnpm`
- **Git**
- A Supabase project (or access to the existing project credentials from 1Password)
- A Gemini API key for AI features

See [README.md](README.md) for full environment setup, including Supabase project creation.

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/<org>/Graphe-Notes.git
cd Graphe-Notes

# 2. Install dependencies (all workspaces)
pnpm install

# 3. Set up environment variables
cp .env.example .env
# Fill in the values — see .env.example for required variables.
# Real credentials are in 1Password.

# 4. Start the dev server
pnpm --filter @workspace/next-app run dev
# App is at http://localhost:3000
```

Changes hot-reload via Next.js HMR. Database schema changes require `pnpm --filter @workspace/db run push`.

---

## Branch Naming

One feature = one branch = one PR.

| Prefix | Use for |
|---|---|
| `feature/name` | New features |
| `fix/name` | Bug fixes |
| `chore/name` | Docs, config, non-behavior changes |
| `refactor/name` | Code restructuring without behavior change |
| `test/name` | Test-only changes |

Always branch from `master`:

```bash
git checkout master
git pull origin master
git checkout -b feature/your-feature-name
```

Never put two unrelated changes on the same branch.

---

## Making Changes

### Session startup

Before touching any files in a new session:

1. Pull latest master: `git fetch origin && git checkout master && git pull origin master`
2. Create (or switch to) the feature branch
3. Verify `.env` exists at repo root; copy `.env.example` if not
4. Run `pnpm install` from repo root

This order matters — editing files before pulling can put changes on a stale branch.

### During development

- Commit frequently with clear messages
- All commits stay local until you explicitly push
- Run `pnpm run typecheck` from repo root to catch type errors early

### Common commands

```bash
# Type check all workspaces
pnpm run typecheck

# Push DB schema changes to Supabase
pnpm --filter @workspace/db run push

# Regenerate API client + Zod schemas from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Run E2E tests (requires dev server on port 3000)
pnpm --filter @workspace/next-app run test:e2e
```

---

## Pull Request Process

1. Push your branch: `git push -u origin feature/your-feature-name`
2. Create a PR: `gh pr create --title "..." --body "..."`
3. **Do not merge.** DiMathew reviews and merges.
4. The PR must pass both CI jobs (Typecheck + E2E) before review.
5. Update the Notion Active Work row: set Status → QA Review, add branch name and Vercel preview URL.

### Definition of Done

A task is not done until all of these are true:

1. Code is on a named branch (never master)
2. Vercel preview URL is generated and functional
3. `posthog.capture()` is added for every new user-facing action
4. Sentry error boundary or `try/catch` + `Sentry.captureException` for every new failure surface
5. Sentry dashboard checked for new unresolved issues; stale dev-build noise resolved
6. Notion Active Work row updated (branch name, preview URL, Status → QA Review)
7. Plain English summary written of what was done and any follow-up tasks
8. If UI was changed: verified at 390px, 768px, 1280px; all interactive elements ≥ 44×44px touch targets; both light and dark mode
9. If adding interactive elements: works with pointer/mouse and touch; no functionality gated behind hover
10. If adding CSS animations: verified in Safari/WebKit
11. If adding new API endpoints or DB tables: RLS policies in place, auth validated, no cross-user data access
12. If touching auth, encryption, or rate limiting: no new security vectors introduced

---

## Code Conventions

**No comments unless the WHY is non-obvious.** If removing a comment wouldn't confuse a future reader, don't write it. Never write docstrings or multi-line comment blocks.

**No extra abstractions.** Solve the problem at hand. Don't design for hypothetical future requirements. Three similar lines is better than a premature abstraction.

**No error handling for impossible cases.** Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs).

**TypeScript strict.** No `any`, no `as unknown as X` unless genuinely unavoidable with a comment explaining why.

**Path aliases.** Inside `artifacts/next-app`, use `@/*` for app-internal imports and `@lib/*` for shared lib imports (e.g. `@lib/encryption`). Never use relative paths that climb above `src/`.

**API calls.** Never write raw `fetch` calls for application data — use generated React Query hooks from `@workspace/api-client-react`. To add an endpoint: edit `lib/api-spec/openapi.yaml` → run `codegen` → import the generated hook.

---

## Commit Messages

Clear and descriptive. No specific format enforced, but follow these norms:

```
feat: add version history restore confirmation dialog
fix: prevent note list from re-rendering on vault state change
chore: update .env.example with TEST_EMAIL
refactor: extract ColorPickerDropdown into its own file
```

Describe the intent, not the implementation. "Fix re-render" is better than "Move useState call".

---

## Git Hooks

Two hooks run automatically. They are installed in `.git/hooks/` by the setup script (or manually — see below).

**`pre-push`** — runs `pnpm run typecheck` before every push. A type error blocks the push.

**`post-merge`** — runs after every `git merge` or `git pull`:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter db push` (applies any new DB migrations)

### Installing hooks

```bash
# macOS / Linux / Git Bash on Windows
chmod +x scripts/pre-push.sh scripts/post-merge.sh
cp scripts/pre-push.sh .git/hooks/pre-push
cp scripts/post-merge.sh .git/hooks/post-merge
```

If a hook fails with a permission error on macOS, run `chmod +x .git/hooks/pre-push .git/hooks/post-merge`.

On Windows, hooks require Git Bash or WSL — the scripts use bash syntax.

---

## Adding shadcn/ui Components

Run from `artifacts/next-app/`:

```bash
pnpm dlx shadcn@latest add <component-name>
```

After install, verify the command didn't overwrite any custom files:

```
src/components/ui/icon-button.tsx
src/components/ui/toolbar-button.tsx
src/components/ui/sonner.tsx
src/components/ui/drawer.tsx
src/components/ui/drawer-left.tsx
src/components/ui/empty.tsx
src/components/ui/resize-handle.tsx
```

If any of these were modified by the add command, restore them from git.

---

## Adding Packages

For packages used only in the Next.js app:

```bash
pnpm add <package> --filter @workspace/next-app
```

For packages shared across workspaces, add to the `catalog:` section of `pnpm-workspace.yaml` and reference with `"catalog:"` in each `package.json`.

---

## Cross-Platform Notes

The codebase must work on macOS, Linux, and Windows. When adding scripts or config:

- Use forward slashes in file paths in config files
- Use `cross-env` for environment variable injection in `package.json` scripts (not `export VAR=value`)
- No bash-only syntax in `package.json` scripts — use Node scripts or cross-platform CLI tools
- Git hooks use bash syntax — Windows contributors should use Git Bash or WSL

Playwright tests and pnpm commands work identically on all platforms.
