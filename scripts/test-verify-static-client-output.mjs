import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { verifyStaticClientOutput } from "./verify-static-client-output.mjs";

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "graphe-static-client-output-"));
  const output = resolve(root, "artifacts/static-client/out");
  mkdirSync(resolve(output, "auth"), { recursive: true });
  mkdirSync(resolve(output, "_next/static/css"), { recursive: true });
  writeFileSync(resolve(output, "index.html"), "<main>Graphe</main>");
  writeFileSync(resolve(output, "auth/callback.html"), "<main>Callback</main>");
  writeFileSync(resolve(output, "graphe_minimalist_1773640203523.png"), "logo");
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
  "missing Graphe logo",
  (root) => rmSync(resolve(root, "artifacts/static-client/out/graphe_minimalist_1773640203523.png")),
  "Static-client output check failed: missing graphe_minimalist_1773640203523.png.",
);

console.log("Static-client output mutation-negative tests passed.");
