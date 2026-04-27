# Observability

Reference for Sentry error tracking and PostHog analytics in Graphe Notes. Read this before adding error handling, analytics events, or debugging production issues.

---

## Sentry

### Setup

Three Sentry configuration files correspond to the three Next.js runtime environments:

| File | Runtime |
|---|---|
| `sentry.client.config.ts` | Browser |
| `sentry.server.config.ts` | Node.js (API routes, SSR) |
| `sentry.edge.config.ts` | Edge runtime (middleware) |

DSN: `NEXT_PUBLIC_SENTRY_DSN` environment variable. Public — safe for client-side code.

Source maps are uploaded to Sentry on every Vercel build via the Sentry webpack plugin in `next.config.ts` (org: `dimathew-roman`, project: `javascript-nextjs`). Source maps allow Sentry to show original TypeScript source in stack traces.

### Sampling

| Setting | Development | Production |
|---|---|---|
| Trace sample rate | 100% | 10% |
| Session replay | 10% | 10% |
| Session replay on error | 100% | 100% |

`sendDefaultPii: true` — Sentry captures user context (IP, user ID) when available.

### OpenTelemetry

`skipOpenTelemetrySetup: true` in `sentry.server.config.ts`. OpenTelemetry auto-instrumentation is disabled because it causes exhaustion of the Vercel Postgres connection pool. Do not re-enable it without testing against the connection pool under load.

### Current coverage

| Location | Type | What's captured |
|---|---|---|
| `app/global-error.tsx` | Error boundary | All uncaught client-side React errors |
| `components/NoteShell.tsx` | try/catch | Note save failures |
| `components/QuickBitShell.tsx` | try/catch | Animation errors, file read errors |
| `app/api/ai/generate/route.ts` | try/catch | AI generation failures |

Most API route handlers do not have Sentry instrumentation in their catch blocks — errors are caught by Next.js and will appear in Sentry only if they're unhandled (which triggers the global error handler). When adding new routes, follow the pattern below.

### Adding Sentry to an API route

```typescript
import { type NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ... handler logic

    return NextResponse.json({ result });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Sentry dashboard checklist (before opening a PR)

1. Check for new unresolved errors caused by your changes — fix them
2. Resolve intentional test errors (e.g. errors caused by running the E2E suite)
3. Resolve stale dev-build noise (errors that only occur on `localhost` and would never appear in prod)

---

## PostHog

### Setup

**Client-side:** `PostHogProvider` in `components/PostHogProvider.tsx` wraps the app. Uses `posthog-js` with `NEXT_PUBLIC_POSTHOG_KEY`. When `NEXT_PUBLIC_POSTHOG_KEY` is absent (CI, local dev without key), PostHog initializes in a no-op mode — capture calls are silently ignored.

**Server-side:** `lib/posthog-server.ts` exports a `getPostHogClient()` singleton using `posthog-node`. Called from API route handlers.

**Proxy:** All PostHog requests from the browser are proxied through `/ingest/*` Next.js rewrites (configured in `next.config.ts`). This reduces ad-blocker interference.

### Naming convention

`noun_verb` — the subject comes first, then the action.

```
note_created       ✓
note_opened        ✓
ai_generate_completed  ✓
created_note       ✗  (verb first)
noteCreated        ✗  (camelCase)
```

All events must include a `timestamp` in ISO format and any relevant IDs (`note_id`, `quick_bit_id`, `user_id` where available).

---

## Full Event Schema

### Client-side events

Events captured from React components via `posthog.capture(event, properties)`.

| Event | Source | Properties |
|---|---|---|
| `note_created` | `NoteList.tsx` | `note_id`, `timestamp` |
| `note_opened` | `NoteList.tsx` | `note_id`, `timestamp` |
| `note_deleted` | `NoteList.tsx`, `NoteShell.tsx` | `note_id`, `timestamp` |
| `note_pinned` | `NoteShell.tsx` | `note_id`, `pinned` (boolean) |
| `note_favorited` | `NoteShell.tsx` | `note_id`, `favorited` (boolean) |
| `note_vaulted` | `NoteShell.tsx` | `note_id`, `vaulted` (boolean) |
| `note_exported` | `NoteShell.tsx` | `format` (`"pdf"` \| `"markdown"`) |
| `editor_opened` | `NoteShell.tsx` | `timestamp` |
| `version_history_restored` | `NoteShell.tsx` | `note_id` |
| `save_as_template_opened` | `NoteShell.tsx` | `note_id`, `timestamp` |
| `template_saved` | `SaveAsTemplateDialog.tsx` | `template_id` (if available), `timestamp` |
| `note_created_from_template` | `TemplatePickerModal.tsx` | `note_id`, `timestamp` |
| `quick_bit_created_from_template` | `TemplatePickerModal.tsx` | `quick_bit_id`, `timestamp` |
| `vault_unlock_attempted` | `NoteShell.tsx`, `Sidebar.tsx` | `success` (boolean), `source` (`"note"` \| `"sidebar"`), `timestamp` |
| `promote_to_note_clicked` | `QuickBitShell.tsx` | `quick_bit_id`, `timestamp` |
| `quick_bit_promoted_to_note` | `QuickBitShell.tsx` | `quick_bit_id`, `note_id` |
| `ai_prompt_submitted` | `AIPanel.tsx` | `provider` |
| `ai_result_inserted` | `AIPanel.tsx` | `note_id` |
| `ai_selection_action_triggered` | `hooks/use-ai-action.ts` | `action`, `provider` |
| `ai_rate_limit_reached` | `hooks/use-ai-action.ts` | `reason` (`"hourly_limit_reached"` \| `"monthly_limit_reached"`), `reset_in_ms` (hourly only) |
| `folder_created` | `Sidebar.tsx` | `parent_folder_id` |
| `search_performed` | `NoteList.tsx` | `query`, `timestamp` |
| `panel_toggled` | `Home.tsx`, `NoteShell.tsx` | panel-specific properties |
| `motion_level_changed` | `hooks/use-motion.ts` | `level`, `timestamp` |
| `perf_editor_init` | `NoteShell.tsx` | `duration_ms`, `timestamp` — production only |
| `perf_note_switch` | `NoteShell.tsx` | `duration_ms`, `note_id`, `timestamp` — production only |
| `perf_app_ready` | `NoteList.tsx` | `duration_ms`, `timestamp` — production only |
| `dark_mode_level_changed` | `hooks/use-atmosphere.ts` | `level`, `timestamp` |
| `colorblind_mode_changed` | `hooks/use-atmosphere.ts` | `mode`, `timestamp` |
| `oauth_login_attempted` | `hooks/use-auth.ts` | `provider` |
| `user_logged_in` | `hooks/use-auth.ts` | `method` (`"email"`) |
| `user_signed_up` | `hooks/use-auth.ts` | `method` (`"email"`) |
| `user_logged_out` | `hooks/use-auth.ts` | _(none)_ |

### Server-side events

Events captured from API route handlers via `getPostHogClient().capture({ distinctId, event, properties })`.

| Event | Source route | Properties |
|---|---|---|
| `note_created` | `POST /api/notes` | `note_id` |
| `note_deleted` | `POST /api/notes/:id/delete` | `note_id` |
| `note_restored` | `POST /api/notes/:id/restore` | `note_id` |
| `ai_generate_completed` | `POST /api/ai/generate` | `provider`, `model`, `input_tokens`, `output_tokens` |
| `vault_setup_completed` | `POST /api/vault/setup` | _(none)_ |
| `vault_unlocked` | `POST /api/vault/unlock` | _(none)_ |

### Events not yet captured

The following user actions have no instrumentation. Add `posthog.capture()` calls when implementing related features:

- `note_moved` (move to folder)
- `note_restored` (client-side, from Recently Deleted view)
- `tag_added`, `tag_removed`
- `attachment_uploaded`
- `folder_deleted`
- `settings_changed` (general settings mutations)
- `quick_bit_created`, `quick_bit_deleted`

---

## Adding New Events

### Client-side

```typescript
import posthog from "posthog-js";

posthog.capture("noun_verb", {
  relevant_id: value,
  timestamp: new Date().toISOString(),
});
```

### Server-side

```typescript
import { getPostHogClient } from "@lib/posthog-server";

getPostHogClient().capture({
  distinctId: user.id,
  event: "noun_verb",
  properties: {
    relevant_id: value,
  },
});
```

### Rules for new events

- Follow `noun_verb` naming
- Include `timestamp` (ISO string) for all time-sensitive events
- Include the primary entity ID (`note_id`, `quick_bit_id`, etc.)
- Add the event to the Full Event Schema table in this file
- Adding a capture call for every new user-facing action is part of the [Definition of Done](CONTRIBUTING.md)

---

## Manual Verification

### Before opening a PR

**Sentry:**
1. Reproduce the user flow on the Vercel preview
2. Open Sentry → Issues → filter by environment (preview/production) and time range
3. If your change introduced new errors, fix them and verify they resolve
4. Mark stale localhost-only issues as resolved so the dashboard stays clean

**PostHog:**
1. Perform the user flow on the Vercel preview
2. Open PostHog → Activity → Live events
3. Verify each new `posthog.capture()` call fires with the correct event name and properties
4. Verify no event fires twice (duplicate captures on re-renders)
