# Capacitor static-webDir feasibility result

**Status:** disposable local feasibility spike. No Capacitor dependency, native
project, production behavior, hosted configuration, credential, device, or service
was changed.

**Baseline:** local `master` / assigned detached worktree at
`cb95db39aa4c3ad5c78c7d2da0f1f3ae94280541` on 2026-08-26.

## Outcome

**The current single Next.js application cannot produce the required static
`webDir` as-is.** Setting only `output: "export"` failed at the first hosted route:

```text
Error: export const dynamic = "force-static"/export const revalidate not configured
on route "/api/attachments/all" with "output: export".
```

This is a structural failure, not a missing static hint: the route requires
authenticated, server-side data and cannot truthfully be emitted as a static API.
There are 41 route handlers under `artifacts/next-app/src/app/api/`.

**A static client bundle is feasible after the hosted boundary is excluded.** In a
temporary copy only, the API directory and middleware were removed from the app
tree, `output: "export"` and `images.unoptimized` were enabled, and inert placeholder
environment values were used. Next.js 16.2.12 then completed TypeScript and emitted
static `/`, `/_not-found`, and `/auth/callback` pages with `out/index.html` and the
rest of the static asset tree. The temporary copy and its generated output are not
part of this commit.

The requested builder route was GPT-5.6 Terra, High effort. Runtime route telemetry
is not exposed here, so this is **accepted-request/unexposed**, not an observed
runtime-route claim.

## Concrete blockers and owners

| Blocker | Current owner | Evidence and required treatment |
| --- | --- | --- |
| Hosted route handlers | `artifacts/next-app/src/app/api/**/route.ts` (41 handlers) | `output: "export"` stops while collecting `/api/attachments/all`. Keep every route hosted; do not mark them static or manufacture static API payloads. |
| JWT middleware | `artifacts/next-app/src/middleware.ts` | It gates `/api/*` with Supabase JWKS verification. A bundled static asset server cannot run it; it stays with the hosted API deployment. |
| Service-role/database/server runtime | `src/lib/auth-server.ts`, `src/lib/supabase-admin.ts`, API handlers, `lib/db`, attachment upload/cron/AI/vault helpers | These depend on service-role credentials, database access, Node APIs, image processing, or server-only authorization. They remain server code. |
| Global response headers | `artifacts/next-app/next.config.ts:44-58` | Next warns that `headers` are not applied to `output: "export"`. The hosted web/API deployment retains these headers; any WebView/static-asset security policy needs a separate reviewed native/static-host decision. |
| PostHog rewrites | `artifacts/next-app/next.config.ts:59-72`, `src/components/PostHogProvider.tsx:54-56` | Next warns that rewrites are not applied. The client currently uses `/ingest`; a static build needs an explicit approved direct telemetry endpoint or a separately hosted proxy, with the existing privacy controls preserved. |
| Image optimization | `next.config.ts:35-43`; `next/image` consumers in page, sidebar, note list, account/settings, and editor image views | The static test required `images.unoptimized: true`. A static client build must use this only in its client-build configuration; hosted web may retain the optimizer. |
| Same-origin authenticated API assumption | `lib/api-client-react/src/custom-fetch.ts:285-339`, generated API paths, and direct attachment calls in `src/components/editor/ImageNodeView.tsx:84-97,215-220` | Calls use relative `/api/...`; from a bundled WebView they point to the asset origin, not the hosted API. Add one concrete client URL resolver used by `customFetch`, `authenticatedFetch`, and direct download/signing calls. It must default to same-origin for web and require an explicit HTTPS API origin for the static build. |
| Cross-origin authorization | hosted API response boundary (currently same-origin) | A static client calling a distinct API origin needs a narrowly allowlisted CORS/preflight policy for the eventual native origins and its `Authorization`/`x-vault-proof` headers. Do not guess those origins before the wrapper configuration exists. |
| OAuth callback/deep link | `src/hooks/use-auth.ts:144-156`, `src/app/auth/callback/page.tsx` | OAuth currently derives `redirectTo` from `window.location.origin` and the callback listens for a browser Supabase session. The static page exists, but a native wrapper needs separately approved redirect registration and an app-link listener/session handoff. No native-auth claim is proven by this web export. |
| Server instrumentation | `src/instrumentation.ts`, server/edge Sentry configuration | These are server-runtime hooks and belong with the hosted service. Client Sentry can remain shared after its static-build configuration is checked. |

## Smallest truthful seam

Create a deliberately small two-deployment boundary, not a speculative native
abstraction:

1. **Hosted API application:** retain the current API routes, middleware,
   `supabaseAdmin`, database access, cron, server/edge instrumentation, current
   response headers, and any server-side telemetry proxy.
2. **Static client application:** owns the static App Router pages, client
   components, Supabase browser client, TanStack Query, Tiptap/Yjs browser replica,
   UI, and `output: "export"` with unoptimized images. It receives public build
   configuration for the hosted API origin and client telemetry endpoint, never a
   service-role key.
3. **One URL-resolution module:** the generated/custom authenticated fetch boundary
   resolves relative API paths against the configured hosted API origin in static
   builds and leaves them relative in the hosted web build. Attachment download and
   signing callers use that same resolver. This is the smallest shared contract; it
   does not create a generic storage, sync, or native-plugin adapter.

The shared client-safe component/hook/editor/query code can remain shared. The
server route tree and server-only libraries must be moved or exposed through the
hosted application so the static client build never discovers them.

## Next bounded implementation slice

Do not add Capacitor yet. In a separately authorized worktree, create a static-client
build target or small client app that imports only client-safe shared code; keep the
existing Next server app responsible for `/api`. Add the single API URL resolver and
replace the direct attachment URL construction. Explicitly configure static-safe
image and telemetry behavior. Do not choose CORS origins, create native projects,
register OAuth redirects, add plugins, or alter authentication persistence in this
slice.

Acceptance checks for that slice:

- a reproducible static build contains `out/index.html` and `out/auth/callback.html`;
- the static source tree contains no API route handlers, middleware, service-role
  client, database client, or server instrumentation import;
- focused tests prove relative web URLs and configured static-client API URLs,
  including attachment download/sign paths and authorization headers;
- the hosted API build retains its existing route and middleware tests;
- the static build has no Next warning about active headers/rewrites and no optimized
  image endpoint dependency;
- a configuration review defines CORS and native OAuth/deep-link test requirements
  without claiming either works before a wrapper exists.

## Checks and limits

| Check | Result | What it proves / does not prove |
| --- | --- | --- |
| Static repository validation | Passed | The recorded local validation passed before this cleanup; it is historical evidence only. |
| `pnpm run typecheck` in the assigned worktree | Blocked | No local `node_modules`; no packages were installed. |
| Temporary ordinary Next build | Reached compile and TypeScript, then failed while evaluating an API route without environment values | This was not used as production evidence. |
| Temporary export with hosted routes present | Failed as quoted above; also warned that headers and rewrites do not apply | Exact evidence that same-app export is not viable. |
| Temporary export after excluding hosted code | Passed; emitted static pages and assets | Evidence for a client-only static build shape, not native, CORS, OAuth, WebView, device, or deployed-runtime acceptance. |

## Rollback

This commit is documentation only. Reverting it removes the feasibility record; no
product behavior, dependency, lockfile, generated artifact, hosted service, or
native project exists to roll back.
