import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const logoName = "graphe_minimalist_1773640203523.png";
const source = resolve(repositoryRoot, "artifacts/next-app/public", logoName);
const destination = resolve(repositoryRoot, "artifacts/static-client/out", logoName);

if (!existsSync(source)) {
  throw new Error(`Static-client asset copy failed: missing canonical ${logoName}.`);
}

mkdirSync(resolve(destination, ".."), { recursive: true });
copyFileSync(source, destination);
