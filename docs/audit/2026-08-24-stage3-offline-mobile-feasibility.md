# Stage 3: offline-first data foundation and Capacitor sequencing

**Status:** planning and architecture decision record only. No dependencies, product
code, schema, migration, hosted-service, credential, private-state, or deployment
change is proposed as completed by this document.

**Repository snapshot:** `codex/stage3-offline-mobile-feasibility` at
`3c1450eceea5057f03f699664f1e36864d4443d4` (the coordinator baseline) on
2026-08-24. The worktree was clean before this document was added.

## Reading this document

- **[Repository fact]** is verified against the snapshot above.
- **[External fact]** is supported by a linked first-party source, checked on
  2026-08-24.
- **[Inference]** is a conclusion from those facts.
- **[Proposal]** is a future design, not an existing contract or owner decision.

## Decision

**Choose A, web-first local-first Yjs, before any Capacitor project is created.**

Build a narrowly scoped, non-vaulted note-body foundation in the existing web app:

1. a per-note `Y.Doc` bound to Tiptap's collaboration support;
2. local `y-indexeddb` persistence under a user- and document-epoch-scoped name;
3. an authenticated, durable HTTP update-log sync path backed by the existing
   Supabase/Postgres boundary; and
4. a server-maintained HTML/text projection for current list, search, export, and
   legacy-rendering callers.

Do not introduce live sharing, cursor presence, offline attachments, offline vault,
or a native wrapper in the first slice. Add Capacitor only after that slice proves
loss-free reopen/reconnect and the mobile auth/package shape has passed its own
spikes. A thin wrapper would package the current online-only save path rather than
make it reliable.

This is deliberately a **device-sync CRDT**, not a promise of collaborative shared
notes. If shared editing becomes a product goal, reassess the sync host, presence,
authorization model, quotas, and privacy disclosure before enabling it.

## Scoped roadmap-status correction

The July audit and Stage 2 roadmap are historical evidence and remain unedited.
They correctly described their then-current baseline, but their phrase that nothing
had been implemented is stale for this snapshot. The following work is now present:

| Historical prerequisite | Current status at `3c1450e` | Evidence |
| --- | --- | --- |
| Flush pending note saves on background/teardown | Shipped for notes and Quick Bits. | `NoteShell.tsx:461-514`; `QuickBitShell.tsx:398-412` |
| Per-note undo reset on item switch | Shipped in the existing imperative editor. | `GrapheEditor.tsx:260-306` |
| Safe mobile back seam | Shipped for list/editor navigation. | `use-mobile-history-nav.ts:5-58` |
| Basic connectivity truthfulness | Shipped as an online/offline warning, explicitly not a queue. | `Providers.tsx:42-69` |
| Full offline document persistence, app offline shell, CRDT sync, Capacitor | **Not found.** There is no Yjs, IndexedDB, service worker/manifest, or Capacitor dependency/configuration in the snapshot. | repository search; `ARCHITECTURE.md:612` |

The last row is the remaining Stage 3 foundation. The old audits are not rewritten
because their findings and chronology are still useful evidence.

## Verified starting point

### Current ownership and constraints

- **[Repository fact]** `GrapheEditor` is the shared Tiptap owner for both
  `NoteShell` and `QuickBitShell`. It receives HTML through `content`, calls
  `onContentChange(editor.getHTML(), editor.getText())` on each update, and
  imperatively calls `setContent(..., { emitUpdate: false })` when `contentKey`
  changes (`artifacts/next-app/src/components/editor/GrapheEditor.tsx:63-79,
  223-306`). It already gives blocks stable `UniqueID` attributes, which is
  helpful but not itself a CRDT contract (`:174-226`).
- **[Repository fact]** `NoteShell` accumulates content/title data, waits 800 ms,
  then directly mutates `notes`; it flushes with a keepalive `PATCH` when hidden
  (`NoteShell.tsx:320-515`). It creates immutable user-facing version snapshots
  after a successful save (`:381-395`). This direct writer must not run alongside
  a CRDT writer for a migrated note.
- **[Repository fact]** `notes.content` is HTML and `content_text` is a search/list
  projection. `note_versions` are separate HTML snapshots with source/label,
  while attachments reference a note and have server-owned Storage paths
  (`lib/db/src/schema/notes.ts:3-62`, `attachments.ts:4-35`).
- **[Repository fact]** the current attachment upload route writes Storage objects
  through a durable reservation/cleanup protocol before it finalizes an attachment
  row. It is an online, server-owned workflow, not a browser outbox
  (`attachment-upload-reservations.ts:15-67`; `api/attachments/upload/route.ts`).
- **[Repository fact]** authentication is a Supabase bearer token checked in
  middleware and again by each route's `getAuthUser`; server routes use a service
  client and therefore bypass RLS (`middleware.ts:1-101`,
  `lib/auth-server.ts:43-112`, `lib/supabase-admin.ts:1-7`). Existing RLS remains
  defense in depth, not a substitute for route ownership checks.
- **[Repository fact]** a vaulted note's content and version/attachment surfaces
  require a short-lived `x-vault-proof`, but the current design does not establish
  encrypted browser-at-rest persistence (`vault-proof.ts:1-46`,
  `vault-note-authorization.ts:1-16`, `api/notes/[id]/route.ts:43-62`).
- **[Repository fact]** server state is TanStack Query and the demo mode is an
  in-memory query-cache fixture; it must stay deterministic and must not create
  real local replicas (`Providers.tsx:13-39`, `app/page.tsx:15-69`).

### External facts that constrain the design

- **[External fact]** a `Y.Doc` emits compact binary updates; updates are
  commutative, associative, and idempotent, so a receiver can apply duplicates or
  differently ordered updates and converge after receiving the full set. State
  vectors let a peer request only the missing differences. [Y.Doc](https://docs.yjs.dev/api/y.doc)
  and [Yjs document updates](https://docs.yjs.dev/api/document-updates).
- **[External fact]** `y-indexeddb` persists a Y document locally and restores it
  on a later visit; it can be combined with a network provider. It does not make
  the app shell available offline, which still requires a service worker.
  [Yjs offline support](https://docs.yjs.dev/getting-started/allowing-offline-editing)
  and [y-indexeddb](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb).
- **[External fact]** Next.js App Router has a manifest convention but its PWA
  guide still requires the application to implement and register a service worker;
  a manifest alone cannot cache the offline shell. [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps).
- **[External fact]** Yjs's `UndoManager` is scoped to shared types, tracks local
  origins selectively, groups changes within its capture timeout, and can force a
  new undo boundary with `stopCapturing()`. [Y.UndoManager](https://docs.yjs.dev/api/undo-manager).
- **[External fact]** Tiptap's collaboration extension owns Yjs-based history;
  its documentation says to disable StarterKit's normal UndoRedo extension and to
  wait for provider synchronization before mounting `UniqueID`-using editors.
  [Tiptap collaboration extension](https://tiptap.dev/docs/editor/extensions/functionality/collaboration).
- **[External fact]** Capacitor first requires a distributable web build, then
  copies/synchronizes that build into Android/iOS projects. A wrapper is therefore
  a separate packaging and native-build concern, not a persistence feature.
  [Capacitor workflow](https://capacitorjs.com/docs/basics/workflow).
- **[External fact]** Capacitor production configuration names `webDir` as the
  compiled web-asset directory containing the final `index.html`. Its `server.url`
  is expressly for live-reload and is not intended for production. [Capacitor
  configuration](https://capacitorjs.com/docs/config) and [Capacitor live
  reload](https://capacitorjs.com/docs/guides/live-reload).
- **[External fact]** Capacitor exposes app state, deep-link, restore-result, and
  Android back-button events. Handling `backButton` replaces the default Android
  behavior and the documentation recommends routing it deliberately (for example,
  through `window.history.back()`). [Capacitor App API](https://capacitorjs.com/docs/apis/app).
- **[External fact]** Capacitor Preferences is a lightweight key/value store and
  explicitly is not a local database. It is unsuitable for note replicas or
  attachment blobs. [Capacitor Preferences](https://capacitorjs.com/docs/apis/preferences).
- **[External fact]** Supabase says Broadcast is the recommended Realtime method
  for scale/security; Postgres Changes is simpler but has scaling limitations.
  Both still need explicit authorization and neither is a durable Yjs update log.
  [Supabase database-change subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).
- **[External fact]** RLS and grants are separate protections; a `service_role`
  key bypasses RLS and must never reach a client. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- **[External fact]** native OAuth, confirmation, and password-reset flows need a
  registered redirect scheme or verified universal/app link plus a handler that
  consumes the returned URL. [Supabase native deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
  and [Capacitor deep links](https://capacitorjs.com/docs/guides/deep-links).

## Feasibility preflight

| Area | Finding and decision |
| --- | --- |
| Product and targets | Graphe Notes is a cloud-backed, personal rich-text web app. Stage 3 must first support current desktop/mobile browsers and their multiple tabs/devices. A future Capacitor wrapper targets Android and iOS. This is **not** an Android implementation yet; no emulator, physical Vivo, install, or app-store claim is in scope. |
| Hosts and packaging | The deployed Next app has server-side `/api` handlers and service-role-only behavior. **[Inference]** it cannot simply become a fully static Capacitor payload without separating those server routes. The **only production Capacitor candidate** is a bundled `webDir` static client calling the hosted authenticated API. If the current Next build cannot produce that client, stop and obtain a separate client-build feasibility decision; `server.url`, cleartext traffic, and live reload are development-only and must not become a production fallback. Do not treat `next build` as proof that this shape exists. |
| Existing third parties | Continue using existing Supabase Auth/Postgres/Storage, Vercel/Next route handlers, Tiptap, Sentry, and PostHog. The proposed first slice adds only open-source Yjs/Tiptap collaboration libraries and no managed collaboration service. A persistent WebSocket host, Tiptap hosted collaboration, native plugins, push, file-system access, and a new MCP are out of scope. |
| Data/infrastructure | Add a server-owned, authenticated Y-update log and compaction snapshot only after a reviewed migration/RLS design. Keep the current `notes` row as the query/read model and retain version and attachment ownership. Do not use Supabase Realtime as the durable source of document content. |
| Auth/secrets/compliance | Each sync request must resolve the authenticated user server-side, enforce note ownership/deletion/vault status, and never expose a service key. The first slice excludes vault replicas and demo mode. Native redirects, keychain/secure-store policy, privacy manifests, and encrypted offline vault need separate approved design and evidence. |
| Offline behavior | A locally durable document is not the same as an offline-launchable app. Stage 3 needs both IndexedDB document persistence and a narrowly cached PWA shell before it may claim reopen-while-offline. The current warning remains the truthful fallback for un-migrated notes. |
| Devices/QA | Start browser-first: Playwright plus two independent authenticated browser contexts, reload/background simulation, browser storage clearing, and mobile-width checks. Before a wrapper ships, use Android emulator and iOS simulator; reserve physical Vivo evidence for later OEM/keyboard/lifecycle claims only. |
| Cost and alternatives | The recommended first slice has no new managed vendor or paid-service commitment, but it adds Postgres storage/egress and server request/compaction work. A dedicated WebSocket host or managed collaboration provider adds operational or subscription cost; a custom operation log adds long-term implementation and verification cost. No current price is approved or asserted here: recheck official pricing, current quotas, and retention before selecting a host or enabling a cohort. |
| Compatibility | Existing HTML must seed a Yjs ProseMirror fragment without silently changing custom nodes, attachments, or `UniqueID`. StarterKit history must be disabled for migrated sessions, existing HTML versions must remain readable, and legacy clients must not write directly to a migrated note. |
| Required spikes | The six bounded spikes listed below are mandatory gates, not optional polish. |

## Options considered

| Option | Authority and conflicts | Offline/mobile consequences | Cost and verdict |
| --- | --- | --- | --- |
| **A. Web-first Yjs + IndexedDB + authenticated server update-log; Capacitor later** | The durable accepted Y-update set plus a verified compaction snapshot is authoritative for body content. Yjs merges concurrent body edits rather than choosing a last writer. Existing `notes.content`/`content_text` become materialized read projections; `note_versions` remain user-visible checkpoints. | Local edits can be durable before reconnect. A service-worker shell is still required for cold offline launch. The same web module runs in browser and future WebView, so Capacitor inherits a proven data contract instead of inventing one. | Lowest incremental vendor cost and the least custom conflict code, but requires a migration, server sync/compaction implementation, browser-storage QA, and explicit vault/attachment scope. **Recommended.** |
| **B. Capacitor-first thin wrapper around the current online-only app** | Current server `PATCH` is authoritative and concurrent tabs/devices are last-write-wins. The currently improved background flush reduces one loss mode but cannot queue a failed write. | It packages the warning "changes may not save" into a native lifecycle that can suspend/terminate more aggressively. It also adds deep-link, app-state, back-button, native build, and store obligations before data correctness is proved. | Cheapest apparent first week, highest avoidable rework and unacceptable offline claim. **Reject.** |
| **C. Local operation-log/outbox without Yjs** | A custom log can order one device's commands, but rich-text concurrent insert/delete/reformat, rebasing, deduplication, convergence, undo, and conflict UI become Graphe-owned protocol work. A naïve replay resolves to last-write-wins. | It can queue metadata and eventually attachments, but it does not solve CRDT editing. A wrapper still needs all native/auth/storage work. | No new collaboration library, but substantially higher engineering, test, recovery, and security cost. Choose only if the owner rejects CRDT semantics after a concrete prototype. **Reject.** |

### Why not start with `y-websocket` or Supabase Realtime?

**[Proposal]** Device sync does not currently need cursor presence or sub-second
shared editing. Use a concrete HTTP sync module over the existing authenticated
route boundary for the first slice: fetch missing updates by state vector, post
idempotent updates, and poll/reconcile on foreground/reconnect. This keeps durable
data and authorization in the existing server/database model and avoids a new
long-lived WebSocket host.

Yjs describes `y-websocket` as a conventional client/server provider that can
carry auth headers/cookies and awareness; it is a good recheck candidate only if
real-time multi-user editing is accepted. [y-websocket](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket).
Supabase Broadcast may later be a wake-up signal or presence transport, but the
client must still retrieve/commit the durable update set. It must not be mistaken
for a document database.

## Proposed data and sync contract

### Authority, lifecycle, and conflict semantics

| Concern | Proposal |
| --- | --- |
| Rich-text body | A `Y.XmlFragment` (for example, `body`) in one `Y.Doc` per note/epoch is authoritative after the server accepts its binary update. The local IndexedDB copy is a durable replica/cache, not the cross-device recovery authority. |
| Legacy read model | The server materializes the accepted CRDT state to the existing `notes.content`, `content_text`, and `updated_at` fields for current listing, search, export, and rollback. It must never accept a legacy direct HTML `PATCH` as a second writer after a note has migrated. |
| Concurrent edits | Merge body edits through Yjs update semantics. There is no user-facing "pick winner" dialog for normal text operations. The UI reports *durable locally*, *syncing*, *synced*, or a specific blocked/error state; it does not call a network-delivered save "saved" prematurely. |
| Metadata | Keep folder, tags, pin, favorite, deletion, and attachment metadata on their existing authenticated server paths initially. Do not imply they work offline. A later offline metadata design needs explicit operation semantics and test cases, not a generic queue. |
| Title | The pilot may keep title online-only to keep the first conversion constrained. Before broad offline rollout, make title either a separately specified Y text field or an explicitly versioned metadata operation; do not use accidental last-write-wins behavior. |
| Version history | Existing HTML snapshots remain valid user checkpoints. Synchronization must not create a version per CRDT update. A version/export request first crosses the exact server-sequence barrier defined below, then records/exports that same accepted state. A restore creates a **new epoch** from the selected authoritative state; it never overwrites or mutates old Y updates. |
| Deletion | A soft delete closes the current epoch atomically. A queued client for that epoch receives a terminal result even if the note is later restored; it never recreates the parent implicitly. Restoration creates a new epoch from selected authoritative state, not from a stale replica. |

### Per-document serialized acknowledgement invariant

**[Proposal]** This is the required commit contract for every production sync
write. It is deliberately more exact than an "eventually materialized" update log.
For a note's current document epoch `E`, `N` means the resulting per-document
server sequence. The document record holds three sequence watermarks:
`acceptedThrough`, `reducedThrough`, and `projectedThrough`.


1. In one database transaction, acquire the per-`{noteId,E}` transaction/row lock.
   Resolve the authenticated user again; fence owner, active/non-deleted note,
   vault proof, `E`, format version, payload limit, and idempotency identity before
   accepting any update.
2. If the idempotency identity already exists, its canonical update digest must
   match the supplied bytes. A mismatch is a terminal idempotency error. A match is
   not acknowledged yet: first bring the document through that record's sequence
   barrier as steps 4–6 require.
3. Starting from the retained verified snapshot plus all accepted updates after its
   covered sequence, decode/apply the candidate update to an isolated reducer
   document. Materialize and validate the candidate against the supported Tiptap
   schema before it is authoritative. A decode, apply, or materialization/validation
   failure inserts no update, advances no watermark, and returns no `synced` result.
4. Append the opaque update idempotently, assigning the next server sequence `N`.
   The log records epoch, update digest/idempotency identity, byte count, and
   accepted timestamp, but no telemetry plaintext. Reduce the accepted state through
   `N` while still holding the same lock.
5. In that same transaction, update the retained snapshot/state vector and set
   `acceptedThrough = reducedThrough = projectedThrough = N`; materialize the same
   state into `notes.content`, `notes.content_text`, and `notes.updated_at`. Commit
   only after all of those writes succeed.
6. Return `syncedThrough: N` only after the transaction commits. If the process
   crashes before commit, the database rolls back the append and projection together.
   If it crashes after commit but before the response, the duplicate retry finds the
   matching record at `N`, verifies the barrier, and returns the same acknowledgement.

The serialized lock is per document, not global. It defines acknowledgement order;
Yjs's commutative/idempotent updates define merge semantics inside that order. A
client may call its state `durable-local` after IndexedDB persistence, but may call
it `synced` only after this exact `syncedThrough: N` acknowledgement.

### Read, version, export, and compaction barriers

- A current-content/list/search read may return the materialized projection only
  when `projectedThrough = acceptedThrough`. If it observes a lagging projection,
  it acquires the same document lock, reduces through the accepted head, and commits
  the projection before returning. It never silently serves a known stale projection
  as current.
- An explicit version, pre-AI checkpoint, restore source read, or export asks for a
  barrier through head `N`. Under the same lock it first completes the invariant,
  then derives the version/export from exactly the reducer state and projection at
  `N`; record that `throughSequence` with the version/export metadata. A version is
  never written from a pre-sync HTML cache after the API has acknowledged `N`.
- A compaction creates a **new**, checksum-verified snapshot whose encoded state and
  vector cover one precise sequence `C`, under the same lock. Only after the
  snapshot pointer and coverage metadata commit may the server remove update rows
  `<= C`, and then only under the approved recovery/export retention policy. It
  never mutates an old snapshot, crosses an epoch boundary, or discards the sole
  recoverable representation. Compaction failure leaves the previous pointer and
  update log intact.

### Server update-log shape

**[Proposal]** The later reviewed schema implements the invariant above:

- A per-note document record has `note_id`, owner identity, `document_epoch`,
  `format_version`, retained snapshot/state vector, the three watermarks, lifecycle
  state (`active` or closed/tombstoned), and compaction metadata.
- An append-only update record has epoch/server sequence, opaque binary update,
  canonical digest/idempotency identity, accepted timestamp, and byte count. It
  does not store note plaintext separately for observability.
- `pull(stateVector, E)` returns a snapshot or missing update bytes only for the
  active authenticated epoch. `push(update, idempotencyKey, E)` follows the
  serialized invariant; malformed, mismatched-idempotency, wrong-epoch,
  unauthorized/vault-locked, deleted, or oversized writes are terminal.

This uses the useful Yjs property that update application is idempotent, not an
assumption that HTTP order is a conflict policy. The particular schema, byte caps,
retention, and compaction cadence must come from the first spike's measured data.

### Epoch fencing for deletion and restoration

**[Proposal]** `E` is never reopened. While holding the same per-document lock,
soft delete first completes the accepted/reduced/projected head `H` for active epoch
`E`, then atomically marks `E` closed/tombstoned through `H` and sets the note's
soft-delete state. Every later `push(..., E)` returns terminal
`document_epoch_closed`, including after the note is restored; old local replicas
are export-only and may not mount, enumerate, or auto-rebase.

Restore selects an authoritative version or tombstoned state at head `H`, seeds a
fresh active epoch `E + 1`, validates/materializes it, and switches the note's
current-document pointer in one transaction. A client must bootstrap `E + 1` after
auth; it cannot replay `E` into it. Permanent deletion closes the active epoch and
applies the separately approved retention/disposition policy before any data is
purged.

Migration follows the same rule: an active legacy note seeds exactly one initial
active epoch after HTML conversion/validation; a legacy deleted note does not gain
an active epoch merely because a stale client appears. Restoring either legacy or
migrated deleted content creates a new epoch. No migration mutates an existing
epoch's update history in place.

### Vault, attachments, identity, retry, recovery, and observability

| Concern | Required rule |
| --- | --- |
| Vault/encryption | **Exclude vaulted notes from the offline pilot.** Current vault authorization returns plaintext to an unlocked client but does not establish a device-held encryption key or encrypted IndexedDB dataset. Offline vault therefore requires an owner-approved threat model, key derivation/recovery/rotation, secure native storage policy, lock-on-background behavior, and independent R3 review. Do not call the existing PIN proof end-to-end encryption. |
| Attachments | Keep attachments online-only for the pilot. The CRDT stores stable attachment references, never signed URLs, blobs, or base64. Offline capture/upload needs a separate durable blob store, quota/eviction handling, staged encryption decision, retryable upload reservation, and a recovery UX; Capacitor Preferences cannot provide it. |
| Identity/device | Supabase user identity authorizes every sync call. A persisted random device installation ID may aid idempotency/diagnostics but is neither authentication nor a Yjs `clientID`. Scope browser replicas by `{userId, noteId, documentEpoch}`. Demo mode remains in-memory and gets no real replica. The plaintext-cache decision and exact auth-boundary disposition contract below are mandatory before this scope is enabled. |
| Retry/quotas | Persist local Y updates before network attempts. `401`, `403`, deleted-note, invalid-update, and incompatible-epoch responses halt automatic retry and surface a recovery action. `429`/transient server/network failures use bounded exponential backoff with jitter and resume on foreground/connectivity; `413` or local quota exhaustion requires compaction/export/recovery UI, never silent loss. Server byte, document-count, retention, and request quotas are configuration with observable reason codes, not magic client constants. |
| Recovery/export | A user can export the current materialized document as HTML and a portable document-backup form that includes format/epoch metadata and encoded state. Clearing local cache must recover from the server's retained snapshot/update set; loss of the server set is not rescued by an individual browser cache. Export/import compatibility needs a separate format/version decision before promising it. |
| Privacy/observability | Sentry/PostHog may record only lifecycle event names, sanitized reason codes, retry count, latency, and coarse byte buckets. Never record Y update bytes, document IDs that are public identifiers, titles, text, attachment names, vault proof, tokens, raw URLs, or local storage keys. Existing privacy controls remain a minimum, not proof for the new path. |

### Owner decision: plaintext IndexedDB for non-vaulted notes

**Decision required before implementation:** may a non-vaulted note body persist as
plaintext in this browser profile's IndexedDB? The recommended default is **no local
replica on a shared browser/device profile** and an explicit opt-in only for a
personal profile. This is a privacy/disposition decision, not an implementation
detail and does not apply to vaulted notes.

If approved, the following is the testable retention/disposition contract. It makes
no silent choice between retaining and removing locally durable note data:

| Event | Required disposition |
| --- | --- |
| Voluntary logout | Close/unmount every session before auth state changes. If any locally durable update is not acknowledged, require the user to choose **export recovery bundle then erase** or **discard pending local changes then erase**. If all are acknowledged, disclose and confirm erase. The app may not leave plaintext replicas mounted after logout. |
| Forced expiry/revocation | Immediately stop rendering/editing/syncing the current session and show a recovery interstitial on return. Before a different account can become active, require the same explicit export-or-discard path for pending data. Re-authentication as the identical user may resume only after identity equality is verified; it must still expose the pending state. |
| Account switch or second login | Before account B becomes active, close all A sessions. For pending A data, block the switch until the user chooses **export then erase** or **discard then erase**; for fully acknowledged A data, disclose and confirm erase. Then prove the A namespace is absent and enumerate only B's `{userId, noteId, epoch}` namespace. B must never mount, enumerate, render, search, or receive an A replica. Only a verified same-user re-authentication may resume a retained session before this switch boundary. |
| Shared-device mode | Local persistence is disabled by default. Enabling it requires the owner's approved personal-profile policy and a user-facing disclosure that note bodies are plaintext in this browser profile. Logging out returns to the voluntary-logout disposition; it is not a privacy wipe that may silently lose pending edits. |
| Soft deletion / restoration | Receipt of an epoch tombstone immediately unmounts and hides the old replica from ordinary UI; it is export-only under the deletion retention policy. It cannot remount merely because the server restores the note. Restoration must bootstrap its new epoch. |
| Permanent deletion / retention expiry | Before local replica removal, present the approved export-or-discard disposition if a recovery export is permitted by deletion policy; otherwise state the policy's irreversible purge consequence and require the explicit destructive confirmation. The implementation must not quietly retain a deleted plaintext replica. |
| User-selected cache clear | Show the exact account/document scope and pending count. Pending local updates require export-or-discard before clearing; after confirmation, prove the selected IndexedDB namespace is absent. Browser eviction is treated as unexpected loss: recover from server or surface a failed recovery, never claim success. |

Required tests cover every row above, plus a direct account-A-to-account-B attempt
that proves B cannot discover A's IndexedDB records through application code or UI.
The browser cannot make plaintext storage safe against a person who already controls
the same browser profile; that is why shared-device use is an owner stop, not a
feature claim.

## The smallest stable seam

Do not add a speculative `StorageAdapter`, `SyncProvider`, or cross-platform
abstraction in the first change. There is only one production local store
(`y-indexeddb`) and one proposed production transport (authenticated HTTP update
log); inventing an interface merely to anticipate a native database or WebSocket
provider would create a shallow module.

Instead, create one concrete, deep **`note-document-session` module** at the seam
between `NoteShell`/`GrapheEditor` and persistence/sync. Its callers know only:

```text
open(note identity + authorized bootstrap) -> session
session.fragment                         -> Tiptap collaboration binding input
session.status                           -> local/sync/blocked state for UI
session.flush(reason)                    -> local durability + attempted network sync
session.close()                          -> releases binding/providers safely
session.exportCheckpoint()               -> explicit recovery artifact
```

Its **interface invariants** are:

- `open` never exposes editable content before the local replica has finished
  loading and the binding's required `UniqueID` ordering is safe;
- `flush` may resolve `durable-local` while offline, but may resolve `synced` only
  after the committed serialized acknowledgement `syncedThrough: N` for the
  current epoch; it reports that sequence rather than treating a transport receipt
  as a commit;
- remote updates and bootstrap/import transactions are never put in the local
  UndoManager's tracked origin set; explicit AI/restore actions call
  `stopCapturing()` at user-visible boundaries;
- `close` preserves an already durable local update before destroying the Y doc,
  IndexedDB provider, and listeners; and
- no session accepts a legacy direct HTML save for its migrated note.

Its **error modes** are intentionally finite: unavailable local storage, bootstrap
authorization/vault block, incompatible or closed epoch/format, invalid server
update, quota/exhausted local storage, deleted note, transient offline/retry, and
unexpected reducer failure. The shell maps these to a user-visible action; it does
not need to understand update encoding, browser events, reconnection, or compaction.

Its **configuration** is injected as a small concrete configuration object:
document format/epoch, authenticated endpoint base, bounded retry policy, and
feature gate. It does not accept keys or raw Supabase service credentials. Its
**performance promise** is no HTML serialization or list refetch on every
keystroke; local persistence happens through Yjs updates and network work is batched
off the typing path. The spike must record actual update-size, foreground/reconnect,
and compaction measurements before setting budgets.

This module creates leverage and locality: one migration point replaces the
currently duplicated direct save concern without making `GrapheEditor` learn
database/auth/queue details. Only when a second real production transport or local
store is approved should an adapter interface be extracted and independently tested.

## Correct sequencing

1. **Freeze scope and decisions.** Record owner decisions below; verify the
   existing database hosted-preflight/role evidence before proposing any migration.
2. **Compatibility spike.** In a throwaway, non-production fixture, migrate a
   representative current HTML note through the actual Tiptap extension set into a
   `Y.XmlFragment`, including custom image/task/table/details/math/video nodes and
   `UniqueID`. Verify HTML/text round trip and explicitly configure collaboration
   history. Stop if any supported node is lossy or initialization produces empty
   paragraphs.
3. **Browser durability spike.** Use `y-indexeddb` in Chromium, Safari/WebKit, and
   Android WebView-equivalent coverage. Test initial load, refresh, background,
   quota/eviction behavior, every plaintext-cache disposition in the owner contract,
   and two tabs. In particular, test export-or-discard before account switch and
   prove an account-B session cannot mount, enumerate, search, or render
   account-A's replica. Measure update volume; do not set quotas by intuition.
4. **Server sync/recovery spike.** Build no public feature until two independent
   authenticated contexts can edit one non-vaulted fixture note offline, reconnect
   in either order, converge, then recover after local cache clearing. Exercise
   duplicate update, two concurrent pushes serialized at `N`/`N+1`, injected reducer
   crashes before and after transaction commit, a deliberately stale projection read,
   a version/export requested immediately after `syncedThrough: N`, deletion while
   offline, delete/push and delete/restore/push races, 401/403, 429/5xx, failed
   compaction, legacy-client block, and export/reimport. The evidence must prove
   that a failure neither acknowledges nor makes an invalid update authoritative.
5. **Web implementation slice.** Gate only new/opt-in non-vaulted note bodies;
   add the PWA shell cache needed for cold offline launch and the exact RLS,
   migration, cross-user, reducer, and privacy tests. Keep un-migrated notes on the
   current truthful online save path.
6. **Controlled migration.** Add a document epoch/version, seed each active note
   exactly once from its existing HTML into one initial epoch, verify the materialized
   projection, and disable the legacy writer for the migrated note. A legacy deleted
   note has no active epoch; any restore creates the next epoch from an authoritative
   state. Never rewrite historical `note_versions` or in-place Y updates. Roll
   forward with a new epoch; rollback by disabling the session/writer while retaining
   update data and current HTML projection.
7. **Broad web acceptance.** Complete browser multi-tab, slow/offline, PWA,
   accessibility, performance, export, privacy, and recovery evidence before
   offering a native build.
8. **Capacitor feasibility spike, then wrapper.** The only production candidate is
   a bundled `webDir` static client whose final `index.html` calls the hosted
   authenticated API. First prove that the current Next application can build that
   client. If it cannot, stop for a separate client-build feasibility decision;
   `server.url`, cleartext traffic, `allowNavigation`, and live reload are
   development-only and cannot be a release fallback. Then test Supabase OAuth/email-
   reset redirect, `appUrlOpen`/launch URL, Android back, app pause/resume, network
   changes, keyboard/safe-area, and native auth/session storage. Add only the plugins
   proven necessary. Use the existing history module rather than a new parallel
   navigator.
9. **Native acceptance.** After Android/iOS emulator evidence, run proportionate
   physical-device/OEM evidence only for claims a browser cannot prove. Push,
   notifications, offline files, biometric/keychain vault, and store release are
   separate future decisions.

### Hard stop and recheck triggers

Stop the current implementation slice and return to architecture review if any of
the following occurs:

- round-trip loses a supported Tiptap node, changes HTML semantics, or breaks
  `UniqueID`/Undo behavior;
- browser/WebView storage cannot retain the measured pilot workload or users cannot
  recover after quota/eviction;
- a server provider cannot enforce owner, deletion, vault, rate, and epoch checks
  without sending private update data to telemetry or a client service key;
- the implementation cannot atomically commit an accepted update, its reducer state,
  its projection, and its acknowledgement barrier, or cannot preserve that invariant
  through compaction/crash recovery;
- the owner does not approve the plaintext IndexedDB retention/disposition contract,
  or an account boundary test lets a second account discover a prior-account replica;
- sync needs shared cursors, collaborators, sub-second presence, or a persistent
  WebSocket host;
- owner requests offline vault, end-to-end encryption, offline attachments, native
  background transfer, push, or cross-user sharing;
- a Next/Capacitor packaging spike cannot produce the bundled static client that
  serves the same authenticated API contract;
- hosted RLS/preflight, retention, pricing/quota, or privacy requirements differ
  from the assumptions in this document.

## Small first implementation slice

**Slice:** one opt-in/new, non-vaulted personal note body in the web app; no sharing,
AI mutation, attachments, title offline editing, folders/tags offline editing, or
native code. It proves a real browser-local document plus a real server recovery
path, rather than a mock queue.

### Acceptance criteria

- The Tiptap body mounts from a fully loaded local Yjs replica and uses
  collaboration/Yjs undo rather than the current shared ProseMirror history.
- After one online bootstrap, an edit made while offline is visibly labelled
  `Saved on this device; waiting to sync`, survives background/reopen with the PWA
  shell offline, and converges after reconnect without a content-loss overwrite.
- Two authenticated browser contexts make distinct offline edits, reconnect in
  either order, and converge to the same body. Duplicate delivery is harmless.
- Two simultaneous authenticated pushes serialize through committed sequences `N`
  and `N+1`; each returned `syncedThrough` is backed by the same committed reducer
  state, snapshot/state vector, and HTML/text/`updated_at` projection. Injected
  reducer failures before commit leave no append/projection/acknowledgement, and a
  crash after commit retries idempotently to the same sequence.
- A deliberately stale projection read first crosses the reducer barrier before it
  returns. A version, restore-source read, or export requested after
  `syncedThrough: N` records/returns the exact state through `N`, not a prior HTML
  projection. A failed compaction preserves the prior snapshot pointer and update
  rows; a successful one proves checksum/coverage before eligible prefix removal.
- In both delete/push orderings, closing epoch `E` is terminal for that push. In a
  delete/restore/push race, every old-`E` push remains terminal and the restore
  bootstraps a validated `E+1`; an old replica is export-only and cannot mount or
  rebase into `E+1`.
- The server rejects cross-user, vaulted-without-proof, deleted, malformed,
  incompatible-epoch, and oversized updates; the client does not retry terminal
  failures automatically.
- The approved plaintext-cache disposition is exercised for voluntary logout,
  forced expiry, account switching, shared-device mode, delete/restore, permanent
  deletion, and explicit cache clearing. Pending data always receives the explicit
  export-or-discard path. An account-B session cannot mount, enumerate, render,
  search, or receive account-A replica data.
- Current list/search/export read the server-materialized HTML/text projection;
  no full-list query fires on each keystroke; no document data enters Sentry or
  PostHog.
- `note_versions` still produce readable legacy snapshots and a restore creates a
  new current change. Existing non-pilot notes continue to use their present save
  path unchanged.
- Focused unit/integration tests, two-context browser E2E, relevant PWA/offline
  browser checks, database migration/RLS tests, `pnpm run typecheck`, and the
  repository test gate pass at the exact implementation head. The hosted preflight
  and native/device gates remain separate evidence, not implied by local tests.

### Rollback

Keep the slice behind a server-evaluated feature gate and retain the old
materialized HTML/text projection. On a fault, disable new session creation and
transport writes for the cohort, serve the current projection through the legacy
editor in read/write mode only after a deliberate one-writer decision, and retain
the update log/local replicas for export and repair. Do not drop documents, cache
data, update rows, or migrations as a rollback action. A migration that cannot
support this fallback is not ready to ship.

## Decisions required from the owner before implementation

1. Approve the product boundary: **single-owner/device sync now; no shared
   collaboration/presence in Stage 3.**
2. Approve the first-slice data authority: Yjs update log/snapshot for migrated
   body content, with `notes` HTML/text as a materialized compatibility projection.
3. Choose vault scope: **recommended default is no offline vault in this stage**;
   otherwise authorize a separate encryption/key-recovery architecture and R3 review.
4. Choose attachment scope: **recommended default is online-only attachments**;
   otherwise authorize a separate blob/outbox, quota, encryption, and recovery design.
5. Approve the initial sync hosting direction: authenticated HTTP update-log routes
   backed by existing Supabase/Postgres, with no new managed collaboration vendor or
   WebSocket host. Any later host/subscription/spend requires current-pricing review
   and separate approval.
6. Approve or reject plaintext IndexedDB persistence for non-vaulted note bodies,
   including the explicit export-or-discard and account-isolation contract above. If
   rejected or undecided, use memory-only editing and do not begin the offline pilot.
7. Approve a narrow opt-in/PWA browser pilot before adding Capacitor. The sole
   production Capacitor path is a bundled `webDir` static client calling the hosted
   authenticated API; if the current Next build cannot create it, authorize a
   separate client-build feasibility decision before native work. Native packaging,
   Android/iOS projects, authentication redirect registration, app-store
   distribution, and device installs remain separate authority gates.

## Risks that remain after this plan

- Convergent CRDT state does not by itself prove product-appropriate UX for
  concurrent rich text, tables, custom nodes, AI edits, or restores; the compatibility
  spike is the gate.
- Browser persistence is subject to platform storage behavior. IndexedDB makes
  local durability possible, not a guarantee against all eviction/device loss.
- The present server-side vault model is not sufficient for encrypted offline data.
- Materialization and compaction can introduce projection lag or corruption if they
  are not transactional/replayable and independently tested.
- Plaintext browser replicas trade offline resilience for profile-local exposure;
  account fencing and explicit disposition reduce application leakage but cannot
  protect data from someone who controls the same browser profile.
- A native wrapper adds deployment, native lifecycle, OAuth redirect, privacy
  manifest, keyboard, WebView, and review responsibilities; it remains downstream.

## Evidence and research record

Commands run before writing this document:

```text
git status --short --branch
git rev-parse HEAD
python3 .ai-os/scripts/validate_runtime.py .ai-os
rg --files / rg -n over editor, persistence, API, auth, vault, attachment,
  React Query, PWA, Yjs, Capacitor, and mobile-navigation owners
```

`validate_runtime.py` passed. The legacy latest-awareness executable named in
`AGENTS.md` was absent at its recorded path, so a latest-playbook comparison could
not be performed; no substitute guidance pin was silently adopted. The repository's
active Personal AI OS development framework receipt identifies
`personal-ai-os@0.5.0-alpha.8` with bundled framework `0.10.3`
(`.ai-os/UPSTREAM.json`).

The external references in this document are direct Yjs, Tiptap, Capacitor,
Supabase, and Next.js documentation links, not third-party summaries. Pricing,
hosting quotas, and browser/device behavior are intentionally not represented as
verified until the bounded spikes and owner approvals above occur.
