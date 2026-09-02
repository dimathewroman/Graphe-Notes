# Graphe Notes Agent Entry Point

<!-- Last audited: 2026-08-15 -->

## Adopted engineering standard

<!-- engineering-playbook-managed:start -->
- Playbook: version `0.8.0`, SHA-256 `fdfeedb9894c25652a74a7e763edfe9aa6ae6ce8b0d88fb74137ddef2236b834`.
- Pinned playbook path: `.engineering-playbook/releases/v0.8.0/PLAYBOOK.md`.
- Latest-awareness command: `/Users/dimathewroman/Repositories/AI-Development-System/Engineering-Playbook/checks/check-latest-guidance.sh AGENTS.md`.
- Latest-awareness policy: check the latest stable release at the start of every material task; never silently consume an untagged branch or silently change this pin.
<!-- engineering-playbook-managed:end -->

For multi-role implementation, follow the pinned Playbook's Adaptive
Orchestrated Coding Delivery guide, including its builder/reviewer topology,
60-minute checkpoint, frozen-head review, and integration record.

## Authority and information boundaries

- The owner's latest explicit decision is highest authority.
- This repository's `AGENTS.md`, engineering profile, architecture, design,
  testing, security, performance, and observability records are authoritative
  for engineering behavior.
- Private Notion pages may track planning, task status, decisions, and rollback
  evidence. They do not replace repository conventions or silently change code
  behavior, Definition of Done, branch ownership, or security requirements.
- Never put credentials, private notes, production exports, auth state, or
  unresolved vulnerability details in Git, prompts, logs, previews, or analytics.

## Stack

- Next.js 16 App Router, React 19, TypeScript, pnpm workspaces
- Tailwind CSS 4, shadcn/Radix, Framer Motion, Tiptap 3
- Zustand for client state and TanStack Query 5 for server state
- Supabase Auth/PostgreSQL, Drizzle, Zod, Orval-generated API clients
- Vercel deployment, Sentry error reporting, PostHog analytics

## Read by task

| File | Read when |
|---|---|
| `docs/ENGINEERING-PROFILE.md` | Planning risk, topology, evidence, or release boundaries |
| `ARCHITECTURE.md` | Locating owners, changing APIs, data, auth, state, or components |
| `DESIGN.md` | Any UI, responsive, theme, motion, or interaction change |
| `TESTING.md` | Adding tests, choosing gates, or preparing a PR |
| `SECURITY.md` | Auth, RLS, vault, encryption, rate limits, or sensitive data |
| `PERFORMANCE.md` | Performance-sensitive work or baseline changes |
| `OBSERVABILITY.md` | Error handling, Sentry, PostHog, or production diagnosis |

## Worktree-aware startup

1. Run the managed latest-awareness command and read the task-triggered files.
2. Inspect `git status`, the current branch/head, and worktree ownership. Preserve
   an assigned branch/worktree and its exact base; do not check out `master`,
   pull, or create a replacement branch inside an assigned task.
3. For a genuinely new unassigned task, fetch first, verify the local default
   branch is clean and aligned with `origin/master`, then create one named branch.
4. Install dependencies, create a local `.env`, or start the development server
   only when the task needs them. Use `.env.example`; never invent or expose
   credentials. Do not push database schema as a startup side effect.

## Architecture and implementation rules

- Full ownership maps and schemas live in `ARCHITECTURE.md`; do not duplicate
  them here. `artifacts/next-app/src/` owns the app, `lib/` shared utilities and
  data/API contracts, and `scripts/` project automation.
- Use generated React Query hooks for OpenAPI-covered endpoints. The documented
  `authenticatedFetch` wrapper is the approved path for intentionally
  spec-external AI, attachment, version, and expiry routes; do not add raw fetches.
- New endpoints or tables require authenticated handlers, input validation,
  Supabase RLS, and explicit cross-user-access tests.
- Keep AI provider keys and vault material within their documented encrypted
  boundaries. Never move secrets to analytics or browser storage not explicitly
  approved by `SECURITY.md`.
- Keep server state in TanStack Query and documented client-only interaction
  state in Zustand. Preserve cache-key and invalidation contracts.
- Add editor behavior through focused components/hooks rather than expanding
  `NoteShell.tsx`; `GrapheEditor` remains the shared Tiptap owner.
- UI changes follow design tokens and must support pointer, keyboard, and touch.
  No required functionality may depend on hover.
- Motion uses the documented motion hooks and must honor reduced/minimal modes.

## Verification and Definition of Done

A change is complete only when proportionate evidence shows:

- it is isolated on the assigned branch/worktree and reports the exact head;
- relevant type, unit, integration, and end-to-end checks pass;
- behavior changes have a functional preview when the runtime makes one
  available; preview/deployment is not required for governance-only changes;
- user actions and new failure surfaces use the approved PostHog and Sentry
  contracts without private payloads;
- UI work is checked at 390px, 768px, and 1280px+, light/dark, keyboard/touch,
  44px targets, reduced motion, and Safari/WebKit when relevant;
- auth, RLS, encryption, rate-limit, migration, and destructive-data changes
  receive R3 evidence and rollback;
- affected architecture, design, testing, performance, security,
  observability, environment, and changelog records are updated;
- the exact implementation head receives the independent review required by
  Adaptive Orchestrated Coding Delivery, followed by combined integration gates;
- the handoff states outcome, tests, risks, rollback, and next action in plain
  English. Update private task tracking when it is available and in scope.

## Commands

```bash
pnpm run typecheck
pnpm --filter @workspace/next-app run dev
pnpm --filter @workspace/next-app run test:e2e
pnpm --filter @workspace/api-spec run codegen
```

Run commands from the repository root. Database schema mutation, production
deployment, paid services, destructive actions, and credential use retain their
explicit owner gates.

## Git and delivery

- One bounded outcome per branch and PR; preserve coordinator-assigned ownership.
- Do not commit directly to `master`. Do not merge or deploy without the owner's
  task-specific approval and required reviewed-head evidence.
- Before pushing, run the relevant repository checks and secret scan. Do not
  bypass hooks or force-push without explicit approval.
- Integration uses exact reviewed commits, dependency-first ordering, and a
  combined gate. Production conflicts move to a dedicated integration worktree.
- Keep this entry point under 300 substantive lines; route detail to the owned
  repository documents above.
