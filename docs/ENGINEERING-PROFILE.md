# Graphe Notes Engineering Profile

## Identity and operating mode

- Project: Graphe Notes
- Owner: Dimathew Roman
- Repository: `dimathewroman/Graphe-Notes` (public source; private owner planning remains outside Git)
- Authoritative engineering records: repository `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `PERFORMANCE.md`, `TESTING.md`, `SECURITY.md`, and `OBSERVABILITY.md`
- Lifecycle: Build and Verify through branch previews; owner review precedes production merge/deployment
- Product outcome: a responsive notes workspace with reliable rich-text editing, search, versioning, templates, attachments, and optional user-controlled AI
- Platform: Next.js 16/React 19 web application, Supabase Auth/PostgreSQL, Drizzle, Vercel, Sentry, and PostHog

## Product, data, and trust boundaries

- Profiles: Web/SaaS, AI-enabled, cloud-backed notes, responsive and touch-capable web
- Notes, vault state, attachments, auth identities, AI keys, and analytics/error fields are sensitive
- Supabase RLS and authenticated server boundaries protect user data; new tables/endpoints require explicit auth and cross-user-access checks
- AI provider selection is user-controlled; prompts, provider retention/training, credential custody, cost, and fallback behavior require explicit contracts
- Private Notion planning and credentials remain outside the public repository

## Selected guidance and quality gates

Use the pinned [guide index](../.engineering-playbook/releases/v0.8.0/guides/README.md) proportionally.

| Guidance | Status | Trigger and evidence |
|---|---|---|
| Adaptive Orchestrated Coding Delivery | Selected | Multi-role implementation, review, integration, and cleanup |
| Product lifecycle, experience, accessibility, and responsive engineering | Selected | Editor journeys, mobile/tablet/desktop widths, touch, keyboard, themes, and motion |
| Software architecture, data, APIs, and AI/ML | Selected | Next.js boundaries, Supabase/Drizzle, generated API clients, editor state, and AI actions |
| Privacy, security, supply chain, and authorized research | Selected | RLS, auth, vaulting, dependencies, Sentry, PostHog, and public-source boundaries |
| Quality engineering, performance, observability, and GitHub delivery | Selected | Type checks, previews, regression evidence, performance budgets, and incident signals |
| Native Android/foldable, embedded, radio, and mechanical guidance | Not Applicable | Current product is HS0 responsive web software |

- Risk: R2 by default; R3 for auth/RLS, vault/encryption, destructive migrations, provider credentials, or production data
- Baseline gate: repository typecheck/test instructions, a functional Vercel preview when available, and affected security/observability checks
- UI evidence: 390px, 768px, and 1280px+; light/dark; keyboard/touch; reduced motion; Safari/WebKit when motion or browser behavior changes
- Recovery: schema and deployment work requires rollback; notes/export/version compatibility must remain explicit

## Governance

<!-- engineering-playbook-managed:start -->
- Adopted playbook version and checksum: `0.8.0`, `fdfeedb9894c25652a74a7e763edfe9aa6ae6ce8b0d88fb74137ddef2236b834`
- Exact pinned playbook path: `.engineering-playbook/releases/v0.8.0/PLAYBOOK.md`
<!-- engineering-playbook-managed:end -->
- Latest stable playbook consulted: verified-published v0.8.0
- Latest consultation: 2026-08-15 owner-authorized Adaptive Orchestrated Coding Delivery adoption
- Newer guidance used: none; v0.8.0 is the adopted baseline
- Standing owner authorization for this change: publish and adopt the governance-only update; application merge/deployment and private planning remain separately governed
- Required independent review: every multi-role implementation receives the reviewer required by Adaptive Orchestrated Coding Delivery; unavailable required review is an owner-decision stop
