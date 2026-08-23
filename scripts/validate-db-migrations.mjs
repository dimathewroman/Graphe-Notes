import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = resolve(repoRoot, "lib/db/drizzle");
const manifest = JSON.parse(
  readFileSync(resolve(migrationsRoot, "migration-manifest.json"), "utf8"),
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (options.expectFailure) {
    if (result.status === 0)
      throw new Error(`${command} unexpectedly succeeded`);
    return result;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result;
}

function verifyChecksums() {
  const entries = Object.values(manifest.tracks).flatMap((track) =>
    Object.values(track).flatMap((value) =>
      Array.isArray(value) ? value : [],
    ),
  );
  for (const entry of entries) {
    const digest = createHash("sha256")
      .update(readFileSync(resolve(migrationsRoot, entry.path)))
      .digest("hex");
    if (digest !== entry.sha256)
      throw new Error(`checksum mismatch: ${entry.path}`);
  }
  const ordered = readdirSync(migrationsRoot)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const manifested = [
    ...manifest.tracks.legacyProvenance.files,
    ...manifest.tracks.productionUpgrade.migrationFiles,
  ].map((entry) => entry.path);
  if (JSON.stringify(ordered) !== JSON.stringify(manifested)) {
    throw new Error(
      "ordered production migration list differs from checksummed manifest",
    );
  }
}

verifyChecksums();

const workDir = mkdtempSync("/private/tmp/graphe-pg-");
const dataDir = resolve(workDir, "pgdata");
const socketDir = resolve(workDir, "socket");
const port = String(56000 + Math.floor(Math.random() * 5000));
run("mkdir", ["-p", socketDir]);

const pg = (database, args, options) =>
  run(
    "psql",
    [
      "-h",
      socketDir,
      "-p",
      port,
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      ...args,
    ],
    options,
  );
const sqlFile = (database, path, options) =>
  pg(database, ["-f", resolve(migrationsRoot, path)], options);
const sql = (database, statement, options) =>
  pg(database, ["-c", statement], options);

function bootstrap(database) {
  sql("postgres", `create database ${database}`);
  sql(
    database,
    "create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;",
  );
}

function applyFresh(database) {
  for (const entry of manifest.tracks.fresh.files)
    sqlFile(database, entry.path);
}

function applyProductionFixture(database) {
  for (const entry of manifest.tracks.productionUpgrade.fixtureFiles) {
    sqlFile(database, entry.path);
  }
}

function validate(database) {
  const result = sql(
    database,
    `select
       (select relrowsecurity from pg_class where oid='private.attachment_upload_reservations'::regclass),
       (select count(*) from pg_constraint where conrelid='private.attachment_upload_reservations'::regclass and contype='f'),
       (select count(*) from pg_indexes where schemaname='private' and tablename='attachment_upload_reservations'),
       (select count(*) from pg_constraint where conname in ('attachments_note_id_notes_id_fk','note_versions_note_id_notes_id_fk') and confdeltype='r'),
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
       (select count(*) from pg_policies where schemaname='public'),
       (select count(*) from pg_indexes where schemaname='public' and indexname in ('attachments_user_id_idx','attachments_note_id_idx','attachments_note_id_created_at_idx','note_versions_user_id_idx','note_versions_note_id_created_at_idx','notes_user_id_deleted_at_idx'));`,
  ).stdout;
  if (
    !/t\s*\|\s*0\s*\|\s*3\s*\|\s*2\s*\|\s*13\s*\|\s*52\s*\|\s*6/.test(result)
  ) {
    throw new Error(`schema invariant validation failed\n${result}`);
  }
  sql(
    database,
    "set role anon; select * from private.attachment_upload_reservations;",
    { expectFailure: true },
  );
  sql(
    database,
    "set role authenticated; select * from private.attachment_upload_reservations;",
    { expectFailure: true },
  );
}

function validateHostedPreflightSql(database) {
  const output = pg(database, [
    "-qAt",
    "-f",
    resolve(migrationsRoot, "hosted-preflight.sql"),
  ]).stdout;
  const line = output
    .split("\n")
    .map((value) => value.trim())
    .find((value) => value.startsWith("{"));
  if (!line) throw new Error("hosted preflight SQL returned no JSON locally");
  const report = JSON.parse(line);
  for (const key of [
    "publicBaseline",
    "publicExecuteRevoked",
    "privateTableReady",
    "runtimePrivileges",
    "clientPrivilegesRevoked",
  ]) {
    if (report[key] !== true) {
      throw new Error(`hosted preflight SQL local invariant failed: ${key}`);
    }
  }
}

function runPsqlAsync(database, statement) {
  const child = spawn(
    "psql",
    [
      "-h",
      socketDir,
      "-p",
      port,
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return {
    child,
    done: new Promise((resolveDone) =>
      child.on("close", (status) => resolveDone({ status, stdout, stderr })),
    ),
  };
}

async function validateFinalizeDeleteRace(database) {
  sql(
    database,
    "insert into notes(id,user_id,title) values (1,'user-1','race');",
  );
  sql(database, "delete from notes where id=1;");
  sql(
    database,
    `insert into private.attachment_upload_reservations(id,user_id,note_id,state,lease_token,lease_expires_at,storage_path,attachment)
    values ('00000000-0000-0000-0000-000000000001','user-1',1,'uploading','00000000-0000-0000-0000-000000000011',now()+interval '1 hour','orphan-1','{}');`,
  );
  const deletionWinning = sql(
    database,
    `begin;
    select id from private.attachment_upload_reservations where id='00000000-0000-0000-0000-000000000001' and state='uploading' for update;
    select id from notes where id=1 and user_id='user-1' and deleted_at is null and auto_delete_at is null for update;
    rollback;
    select (select count(*) from attachments), (select count(*) from private.attachment_upload_reservations);`,
  ).stdout;
  if (!/0\s*\|\s*1/.test(deletionWinning)) {
    throw new Error(
      `deletion-winning race invariant failed\n${deletionWinning}`,
    );
  }

  sql(
    database,
    "insert into notes(id,user_id,title) values (2,'user-1','race');",
  );
  sql(
    database,
    `insert into private.attachment_upload_reservations(id,user_id,note_id,state,lease_token,lease_expires_at,storage_path,attachment)
    values ('00000000-0000-0000-0000-000000000002','user-1',2,'uploading','00000000-0000-0000-0000-000000000022',now()+interval '1 hour','object-2','{}');`,
  );
  const finalizer = runPsqlAsync(
    database,
    `begin;
    select id from private.attachment_upload_reservations where id='00000000-0000-0000-0000-000000000002' and lease_token='00000000-0000-0000-0000-000000000022' and state='uploading' and lease_expires_at>now() for update;
    select id from notes where id=2 and user_id='user-1' and deleted_at is null and auto_delete_at is null for update;
    select pg_advisory_xact_lock(424242); select pg_sleep(2);
    insert into attachments(note_id,user_id,file_name,file_type,file_size,storage_path) values (2,'user-1','fixture','text/plain',1,'object-2');
    delete from private.attachment_upload_reservations where id='00000000-0000-0000-0000-000000000002' and lease_token='00000000-0000-0000-0000-000000000022'; commit;`,
  );
  let observed = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const locks = sql(
      database,
      "select count(*) from pg_locks where locktype='advisory' and granted;",
    ).stdout;
    if (/\b1\b/.test(locks)) {
      observed = true;
      break;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  if (!observed) throw new Error("finalization lock was not observed");
  const deletion = runPsqlAsync(database, "delete from notes where id=2;");
  const [finalizerResult, deletionResult] = await Promise.all([
    finalizer.done,
    deletion.done,
  ]);
  if (finalizerResult.status !== 0 || deletionResult.status === 0) {
    throw new Error(
      `finalization-winning race invariant failed\n${finalizerResult.stderr}\n${deletionResult.stderr}`,
    );
  }
  const serial = sql(
    database,
    "select (select count(*) from attachments where note_id=2), (select count(*) from private.attachment_upload_reservations where note_id=2);",
  ).stdout;
  if (!/1\s*\|\s*0/.test(serial))
    throw new Error(`finalization serial order failed\n${serial}`);
}

try {
  run("initdb", [
    "-D",
    dataDir,
    "--auth=trust",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  run("pg_ctl", [
    "-D",
    dataDir,
    "-l",
    resolve(workDir, "postgres.log"),
    "-o",
    `-k ${socketDir} -p ${port}`,
    "-w",
    "start",
  ]);
  sql(
    "postgres",
    "create role anon nologin; create role authenticated nologin;",
  );

  bootstrap("fresh_path");
  applyFresh("fresh_path");
  validate("fresh_path");

  bootstrap("upgrade_path");
  applyProductionFixture("upgrade_path");
  sqlFile("upgrade_path", "0007_attachment_upload_reservations.sql");
  validate("upgrade_path");
  validateHostedPreflightSql("upgrade_path");
  await validateFinalizeDeleteRace("upgrade_path");

  bootstrap("unexpected_baseline");
  applyProductionFixture("unexpected_baseline");
  sql(
    "unexpected_baseline",
    "alter table attachments drop constraint attachments_note_id_notes_id_fk;",
  );
  sqlFile("unexpected_baseline", "0007_attachment_upload_reservations.sql", {
    expectFailure: true,
  });

  console.log(
    "migration validation passed: provenance checksums, fresh path, checksummed 0006-equivalent upgrade, fail-closed baseline, finalize/delete serial order, hosted preflight SQL invariants (local only)",
  );
} finally {
  spawnSync("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], {
    encoding: "utf8",
  });
  rmSync(workDir, { recursive: true, force: true });
}
