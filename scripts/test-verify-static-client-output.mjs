import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { verifyStaticClientOutput } from "./verify-static-client-output.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const logoName = "graphe_minimalist_1773640203523.png";

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "graphe-static-client-output-"));
  const output = resolve(root, "artifacts/static-client/out");
  mkdirSync(resolve(output, "auth"), { recursive: true });
  mkdirSync(resolve(output, "_next/static/css"), { recursive: true });
  writeFileSync(resolve(output, "index.html"), "<main>Graphe</main>");
  writeFileSync(resolve(output, "auth/callback.html"), "<main>Callback</main>");
  const canonicalLogo = resolve(repositoryRoot, "artifacts/next-app/public", logoName);
  mkdirSync(resolve(root, "artifacts/next-app/public"), { recursive: true });
  copyFileSync(canonicalLogo, resolve(root, "artifacts/next-app/public", logoName));
  copyFileSync(canonicalLogo, resolve(output, logoName));
  writeFileSync(
    resolve(output, "_next/static/css/app.css"),
    ".min-h-screen{min-height:100vh}.flex{display:flex}",
  );
  return root;
}

function rejects(name, mutate, expectedMessage) {
  const root = fixture();
  try {
    mutate(root);
    try {
      verifyStaticClientOutput(root);
    } catch (error) {
      if (error instanceof Error && error.message === expectedMessage) return;
      throw new Error(`Verifier rejected ${name} with an unexpected diagnostic: ${error}`);
    }
    throw new Error(`Verifier accepted ${name}.`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const accepted = fixture();
try {
  verifyStaticClientOutput(accepted);
} finally {
  rmSync(accepted, { recursive: true, force: true });
}

rejects(
  "raw Tailwind directive",
  (root) => writeFileSync(resolve(root, "artifacts/static-client/out/_next/static/css/app.css"), "@apply flex;"),
  "Static-client output check failed: CSS retains raw @apply.",
);
rejects(
  "missing compiled utility",
  (root) => writeFileSync(resolve(root, "artifacts/static-client/out/_next/static/css/app.css"), ".min-h-screen{min-height:100vh}"),
  "Static-client output check failed: CSS is missing compiled .flex.",
);
rejects(
  "materialized Graphe logo symlink",
  (root) => writeFileSync(resolve(root, "artifacts/static-client/out", logoName), "../../next-app/public/graphe_minimalist_1773640203523.png"),
  "Static-client output check failed: exported graphe_minimalist_1773640203523.png is not a PNG.",
);
rejects(
  "noncanonical Graphe PNG",
  (root) => writeFileSync(resolve(root, "artifacts/static-client/out", logoName), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "Static-client output check failed: exported graphe_minimalist_1773640203523.png does not match the canonical asset.",
);

console.log("Static-client output mutation-negative tests passed.");
