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
      "-qAt",
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
  const result = scalar(
    database,
    `select concat_ws(',',
       (select relrowsecurity from pg_class where oid='private.attachment_upload_reservations'::regclass),
       (select count(*) from pg_constraint where conrelid='private.attachment_upload_reservations'::regclass and contype='f'),
       (select count(*) from pg_indexes where schemaname='private' and tablename='attachment_upload_reservations'),
       (select count(*) from pg_constraint where conname in ('attachments_note_id_notes_id_fk','note_versions_note_id_notes_id_fk') and confdeltype='r'),
       (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity),
       (select count(*) from pg_policies where schemaname='public'),
       (select count(*) from pg_indexes where schemaname='public' and indexname in ('attachments_user_id_idx','attachments_note_id_idx','attachments_note_id_created_at_idx','note_versions_user_id_idx','note_versions_note_id_created_at_idx','notes_user_id_deleted_at_idx')));`,
  );
  if (result !== "t,0,3,2,13,52,6") {
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

function scalar(database, statement) {
  const output = pg(database, ["-qAt", "-c", statement]).stdout.trim();
  if (output.includes("\n")) {
    throw new Error(`expected one tuples-only scalar, received: ${output}`);
  }
  return output;
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

function policyFingerprint(database) {
  return pg(database, [
    "-qAt",
    "-c",
    `select md5(string_agg(
       concat_ws('|', schemaname, tablename, policyname, cmd,
         array_to_string(roles, ','),
         regexp_replace(coalesce(qual,''), '\\s+', '', 'g'),
         regexp_replace(coalesce(with_check,''), '\\s+', '', 'g')),
       E'\\n' order by schemaname, tablename, policyname))
     from pg_policies where schemaname='public';`,
  ]).stdout.trim();
}

function expectHostedPreflightFailure(database) {
  try {
    validateHostedPreflightSql(database);
  } catch {
    return;
  }
  throw new Error("hosted preflight unexpectedly accepted a mutated baseline");
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

async function acquireGate(database, key) {
  const child = spawn("psql", [
    "-h",
    socketDir,
    "-p",
    port,
    "-d",
    database,
    "-qAt",
    "-v",
    "ON_ERROR_STOP=1",
  ]);
  let output = "";
  const ready = new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new Error(`gate ${key} handshake timed out`)),
      5_000,
    );
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes(`GATE_READY_${key}`)) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
    child.on("close", (status) => {
      if (!output.includes(`GATE_READY_${key}`)) {
        clearTimeout(timeout);
        rejectReady(new Error(`gate ${key} exited early with ${status}`));
      }
    });
  });
  child.stdin.write(
    `select pg_advisory_lock(${key}); select 'GATE_READY_${key}';\n`,
  );
  await ready;
  return async () => {
    child.stdin.write(`select pg_advisory_unlock(${key});\n\\q\n`);
    await new Promise((resolveDone, rejectDone) => {
      const timeout = setTimeout(
        () => rejectDone(new Error(`gate ${key} release timed out`)),
        5_000,
      );
      child.on("close", (status) => {
        clearTimeout(timeout);
        if (status === 0) resolveDone();
        else rejectDone(new Error(`gate ${key} release failed with ${status}`));
      });
    });
  };
}

async function waitForScalar(database, statement, expected, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (scalar(database, statement) === expected) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(`${label} handshake was not observed`);
}

async function validateFinalizeDeleteRace(database) {
  for (const id of [1, 2]) {
    sql(
      database,
      `insert into notes(id,user_id,title) values (${id},'user-1','race');`,
    );
    sql(
      database,
      `insert into private.attachment_upload_reservations(id,user_id,note_id,state,lease_token,lease_expires_at,storage_path,attachment)
      values ('00000000-0000-0000-0000-00000000000${id}','user-1',${id},'uploading','00000000-0000-0000-0000-0000000000${id}${id}',now()+interval '1 hour','object-${id}','{}');`,
    );
  }

  // Deletion wins: hold its UPDATE after it owns the note lock, start the
  // finalizer, prove that finalizer is blocked, then release deletion to commit.
  const releaseDeleteGate = await acquireGate(database, 710001);
  const softDelete = runPsqlAsync(
    database,
    `/* soft_delete_winning */ begin;
    update notes set deleted_at=now(), auto_delete_at=now() where id=1;
    select pg_advisory_lock(710001); commit;`,
  );
  await waitForScalar(
    database,
    "select count(*) from pg_locks where locktype='advisory' and objid=710001 and not granted;",
    "1",
    "soft-delete winner",
  );
  const losingFinalizer = runPsqlAsync(
    database,
    `/* finalizer_deletion_winning */ begin;
    select id from private.attachment_upload_reservations where id='00000000-0000-0000-0000-000000000001' and state='uploading' for update;
    select id from notes where id=1 and user_id='user-1' and deleted_at is null and auto_delete_at is null for update;
    rollback;`,
  );
  await waitForScalar(
    database,
    "select count(*) from pg_stat_activity where query like '/* finalizer_deletion_winning */%' and wait_event_type='Lock';",
    "1",
    "blocked losing finalizer",
  );
  await releaseDeleteGate();
  const [softDeleteResult, losingFinalizerResult] = await Promise.all([
    softDelete.done,
    losingFinalizer.done,
  ]);
  if (softDeleteResult.status !== 0 || losingFinalizerResult.status !== 0) {
    throw new Error(
      `deletion-winning sessions failed\n${softDeleteResult.stderr}\n${losingFinalizerResult.stderr}`,
    );
  }
  const deletionWinning = scalar(
    database,
    `select concat_ws(',',
    (select count(*) from attachments where note_id=1),
    (select count(*) from private.attachment_upload_reservations where note_id=1),
    (select count(*) from notes where id=1 and deleted_at is not null and auto_delete_at is not null));`,
  );
  if (deletionWinning !== "0,1,1")
    throw new Error(`deletion-winning invariant failed: ${deletionWinning}`);

  // Finalization wins: hold it after both row locks, prove the soft delete is
  // blocked, then commit the attachment and observe the update serialize after.
  const releaseFinalizeGate = await acquireGate(database, 710002);
  const finalizer = runPsqlAsync(
    database,
    `/* finalizer_winning */ begin;
    select id from private.attachment_upload_reservations where id='00000000-0000-0000-0000-000000000002' and lease_token='00000000-0000-0000-0000-000000000022' and state='uploading' and lease_expires_at>now() for update;
    select id from notes where id=2 and user_id='user-1' and deleted_at is null and auto_delete_at is null for update;
    select pg_advisory_lock(710002);
    insert into attachments(note_id,user_id,file_name,file_type,file_size,storage_path) values (2,'user-1','fixture','text/plain',1,'object-2');
    delete from private.attachment_upload_reservations where id='00000000-0000-0000-0000-000000000002' and lease_token='00000000-0000-0000-0000-000000000022'; commit;`,
  );
  await waitForScalar(
    database,
    "select count(*) from pg_locks where locktype='advisory' and objid=710002 and not granted;",
    "1",
    "finalization winner",
  );
  const serializedSoftDelete = runPsqlAsync(
    database,
    "/* soft_delete_after_finalizer */ update notes set deleted_at=now(), auto_delete_at=now() where id=2;",
  );
  await waitForScalar(
    database,
    "select count(*) from pg_stat_activity where query like '/* soft_delete_after_finalizer */%' and wait_event_type='Lock';",
    "1",
    "serialized soft delete",
  );
  await releaseFinalizeGate();
  const [finalizerResult, serializedDeleteResult] = await Promise.all([
    finalizer.done,
    serializedSoftDelete.done,
  ]);
  if (finalizerResult.status !== 0 || serializedDeleteResult.status !== 0) {
    throw new Error(
      `finalization-winning sessions failed\n${finalizerResult.stderr}\n${serializedDeleteResult.stderr}`,
    );
  }
  const finalizationWinning = scalar(
    database,
    `select concat_ws(',',
    (select count(*) from attachments where note_id=2),
    (select count(*) from private.attachment_upload_reservations where note_id=2),
    (select count(*) from notes where id=2 and deleted_at is not null and auto_delete_at is not null));`,
  );
  if (finalizationWinning !== "1,0,1")
    throw new Error(
      `finalization-winning invariant failed: ${finalizationWinning}`,
    );

  const hardDelete = runPsqlAsync(database, "delete from notes where id=2;");
  const hardDeleteResult = await hardDelete.done;
  if (hardDeleteResult.status === 0)
    throw new Error("hard delete bypassed attachment RESTRICT FK");
  const hardDeleteState = scalar(
    database,
    "select concat_ws(',',(select count(*) from notes where id=2),(select count(*) from attachments where note_id=2));",
  );
  if (hardDeleteState !== "1,1")
    throw new Error(`hard-delete FK invariant failed: ${hardDeleteState}`);
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
  if (
    policyFingerprint("upgrade_path") !== "341e79862c6b3e82458bb54ca3b46d76"
  ) {
    throw new Error("production fixture policy fingerprint differs");
  }
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

  bootstrap("mutated_policy");
  applyProductionFixture("mutated_policy");
  sql(
    "mutated_policy",
    'alter policy "attachments_select" on attachments using (true);',
  );
  sqlFile("mutated_policy", "0007_attachment_upload_reservations.sql", {
    expectFailure: true,
  });

  bootstrap("mutated_execute");
  applyProductionFixture("mutated_execute");
  sql(
    "mutated_execute",
    "grant execute on function public.rls_auto_enable() to anon;",
  );
  sqlFile("mutated_execute", "0007_attachment_upload_reservations.sql", {
    expectFailure: true,
  });

  bootstrap("hosted_policy_negative");
  applyProductionFixture("hosted_policy_negative");
  sqlFile("hosted_policy_negative", "0007_attachment_upload_reservations.sql");
  sql(
    "hosted_policy_negative",
    'alter policy "attachments_select" on attachments using (true);',
  );
  expectHostedPreflightFailure("hosted_policy_negative");

  bootstrap("hosted_execute_negative");
  applyProductionFixture("hosted_execute_negative");
  sqlFile("hosted_execute_negative", "0007_attachment_upload_reservations.sql");
  sql(
    "hosted_execute_negative",
    "grant execute on function public.rls_auto_enable() to authenticated;",
  );
  expectHostedPreflightFailure("hosted_execute_negative");

  console.log(
    "migration validation passed: exact tuples/checksums/policies, fresh and 0006-equivalent upgrade, mutated-policy and client-EXECUTE negatives, synchronized soft-delete serial order, hard-delete RESTRICT, hosted preflight SQL (local only)",
  );
} finally {
  spawnSync("pg_ctl", ["-D", dataDir, "-m", "fast", "-w", "stop"], {
    encoding: "utf8",
  });
  rmSync(workDir, { recursive: true, force: true });
}
