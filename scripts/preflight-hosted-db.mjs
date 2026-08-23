import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.GRAPHE_HOSTED_PREFLIGHT_DB_URL;
const expectedRole = process.env.GRAPHE_EXPECTED_RUNTIME_DB_ROLE;
if (!databaseUrl || !expectedRole) {
  console.error(
    "Set GRAPHE_HOSTED_PREFLIGHT_DB_URL and GRAPHE_EXPECTED_RUNTIME_DB_ROLE explicitly. No database was contacted.",
  );
  process.exit(2);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = resolve(repoRoot, "lib/db/drizzle/hosted-preflight.sql");
const result = spawnSync(
  "psql",
  ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-f", sqlPath],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      PGDATABASE: databaseUrl,
      PGCONNECT_TIMEOUT: "10",
    },
  },
);
if (result.status !== 0) {
  console.error(
    "Hosted database preflight failed; credentials were not printed.",
  );
  process.exit(1);
}

const line = result.stdout
  .split("\n")
  .map((value) => value.trim())
  .find((value) => value.startsWith("{"));
if (!line) {
  console.error("Hosted database preflight returned no validation result.");
  process.exit(1);
}

const report = JSON.parse(line);
const safeReport = {
  currentUser: report.currentUser,
  expectedRole,
  runtimeRoleMatches: report.currentUser === expectedRole,
  publicBaseline: report.publicBaseline === true,
  publicExecuteRevoked: report.publicExecuteRevoked === true,
  privateTableReady: report.privateTableReady === true,
  runtimePrivileges: report.runtimePrivileges === true,
  clientPrivilegesRevoked: report.clientPrivilegesRevoked === true,
};
console.log(JSON.stringify(safeReport, null, 2));

if (Object.values(safeReport).some((value) => value === false)) process.exit(1);
