import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(repositoryRoot, "artifacts/static-client/out");
const requiredFiles = ["index.html", "auth/callback.html"];

for (const file of requiredFiles) {
  if (!existsSync(resolve(outputRoot, file))) {
    console.error(`Static-client output check failed: missing ${file}.`);
    process.exit(1);
  }
}

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

const forbiddenCodeMarkers = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "@workspace/db",
  "@sentry/node",
  "default-stylesheet.css",
];
const outputFiles = filesUnder(outputRoot);
for (const file of outputFiles) {
  if (!/\.(?:html|js|json|txt)$/u.test(file)) continue;
  const contents = readFileSync(file, "utf8");
  const marker = forbiddenCodeMarkers.find((candidate) => contents.includes(candidate));
  if (marker) {
    console.error(`Static-client output check failed: ${file} contains ${marker}.`);
    process.exit(1);
  }

  // Next's client runtime retains generic image-loader code, but exported HTML
  // must never reference the hosted optimizer endpoint.
  if (file.endsWith(".html") && contents.includes("/_next/image")) {
    console.error(`Static-client output check failed: ${file} references /_next/image.`);
    process.exit(1);
  }
}

console.log("Static-client output check passed (required pages and no optimized-image/server markers).");
