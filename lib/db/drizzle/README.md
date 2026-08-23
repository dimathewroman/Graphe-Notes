# Database migration tracks

`meta/_journal.json` is retained as Drizzle generator provenance only. It lists
the original generated `0000` snapshot and is not a trustworthy deployment
ledger: migrations `0001` through `0006` were historically applied or recorded
outside that journal. Rewriting it would make an existing database appear safe
to replay when that has not been proven.

`migration-manifest.json` is the authoritative source-controlled ordering and
SHA-256 inventory:

- `productionUpgrade` preserves the historical SQL hashes and permits `0007`
  only after its SQL preflight proves the production-equivalent `0006`
  `ON DELETE RESTRICT` baseline.
- `fresh` creates the complete current schema, establishes current public RLS
  policies, and hardens the private upload-cleanup inventory.

Run `pnpm run db:migrations:validate` before integration. It uses disposable
local PostgreSQL databases and proves both tracks plus the fail-closed negative
case. It never reads `SUPABASE_DB_URL`.

Applying SQL to a hosted database remains a separate operator action. Before
applying `0007`, prove the direct runtime database role and grant only that role
`USAGE` on `private` and CRUD on
`private.attachment_upload_reservations`. Do not drop the table during app
rollback; retain it until the cleanup inventory is empty.
