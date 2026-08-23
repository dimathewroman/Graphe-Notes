# Database migration tracks

`meta/_journal.json` is retained as Drizzle generator provenance only. It lists
the original generated `0000` snapshot and is not a trustworthy deployment
ledger: migrations `0001` through `0006` were historically applied or recorded
outside that journal. Rewriting it would make an existing database appear safe
to replay when that has not been proven.

`migration-manifest.json` is the authoritative source-controlled SHA-256
inventory. It separates evidence with different meanings:

- `legacyProvenance` preserves hashes for `0000` through `0006` and explicitly
  marks that broken historical sequence as non-replayable.
- `productionUpgrade` creates an explicitly checksummed synthetic
  production-equivalent-`0006` fixture, then proves that `0007` accepts that
  complete public table/RLS/policy/revoke/index/constraint fingerprint. Policy
  identity includes schema, table, name, command, roles, normalized `qual`, and
  normalized `with_check`; counts alone are not accepted.
- `fresh` creates the complete current schema, establishes current public RLS
  policies, and hardens the private upload-cleanup inventory.

Run `pnpm run db:migrations:validate` before integration. It uses disposable
local PostgreSQL databases and proves both tracks plus the fail-closed negative
cases for policy mutation and client-role function grants. Its upload race uses
observed advisory/row-lock handshakes and exact tuples-only scalar parsing; no
formatted row-count text or timing sleep is an oracle. It never reads
`SUPABASE_DB_URL`.

Applying SQL to a hosted database remains a separate operator action. Before
deploying the app, an operator must apply the reviewed SQL, prove the exact
direct runtime role, grant only that role `USAGE` on `private` and CRUD on the
reservation table, then explicitly run the read-only hosted check:

```bash
GRAPHE_HOSTED_PREFLIGHT_DB_URL='...' \
GRAPHE_EXPECTED_RUNTIME_DB_ROLE='proven-role' \
pnpm run db:hosted-preflight
```

The command is never invoked by local validation, builds, or deployment hooks;
it runs a read-only transaction and does not print the URL. Its live result and
runtime-role ownership remain unproven in source. Do not drop the table during
app rollback; retain it until the cleanup inventory is empty.
