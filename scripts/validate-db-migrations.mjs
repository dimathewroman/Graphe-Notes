import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
  const entries = Object.values(manifest.tracks).flatMap(
    (track) => track.files,
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
  const manifested = manifest.tracks.productionUpgrade.files.map(
    (entry) => entry.path,
  );
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

function validate(database) {
  const result = sql(
    database,
    `select
       (select relrowsecurity from pg_class where oid='private.attachment_upload_reservations'::regclass),
       (select count(*) from pg_constraint where conrelid='private.attachment_upload_reservations'::regclass and contype='f'),
       (select count(*) from pg_indexes where schemaname='private' and tablename='attachment_upload_reservations'),
       (select count(*) from pg_constraint where conname in ('attachments_note_id_notes_id_fk','note_versions_note_id_notes_id_fk') and confdeltype='r'),
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity);`,
  ).stdout;
  if (!/t\s*\|\s*0\s*\|\s*3\s*\|\s*2\s*\|\s*13/.test(result)) {
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
  applyFresh("upgrade_path");
  sql(
    "upgrade_path",
    "drop table private.attachment_upload_reservations; drop schema private;",
  );
  sqlFile("upgrade_path", "0007_attachment_upload_reservations.sql");
  validate("upgrade_path");

  bootstrap("unexpected_baseline");
  applyFresh("unexpected_baseline");
  sql(
    "unexpected_baseline",
    "drop table private.attachment_upload_reservations; drop schema private; alter table attachments drop constraint attachments_note_id_notes_id_fk;",
  );
  sqlFile("unexpected_baseline", "0007_attachment_upload_reservations.sql", {
    expectFailure: true,
  });

  console.log(
    "migration validation passed: checksums, fresh path, 0006-equivalent upgrade, fail-closed baseline",
  );
} finally {
  spawnSync("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], {
    encoding: "utf8",
  });
  rmSync(workDir, { recursive: true, force: true });
}
