import { existsSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const staticClientRoot = resolve(repositoryRoot, "artifacts/static-client");
const hostedSourceRoot = resolve(repositoryRoot, "artifacts/next-app/src");
const apiClientRoot = resolve(repositoryRoot, "lib/api-client-react/src");
const sharedLibraryRoot = resolve(repositoryRoot, "lib");
const entrypoints = [
  resolve(staticClientRoot, "app/layout.tsx"),
  resolve(staticClientRoot, "app/page.tsx"),
  resolve(staticClientRoot, "app/auth/callback/page.tsx"),
];
const allowedExtensions = [".ts", ".tsx", ".js", ".jsx"];
const forbiddenPathFragments = [
  "/artifacts/next-app/src/app/api/",
  "/artifacts/next-app/src/middleware.ts",
  "/artifacts/next-app/src/instrumentation.ts",
  "/artifacts/next-app/src/lib/auth-server.ts",
  "/artifacts/next-app/src/lib/supabase-admin.ts",
  "/artifacts/next-app/src/lib/note-cleanup.ts",
  "/artifacts/next-app/src/lib/attachment-upload-reservation.ts",
  "/lib/db/",
  "/lib/encryption.ts",
  "/lib/ai-rate-limit.ts",
  "/lib/safe-external-fetch.ts",
];
const forbiddenSpecifiers = [
  "@workspace/db",
  "next/headers",
  "next/server",
  "server-only",
];
const importPattern = /(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gu;

function display(file) {
  return relative(repositoryRoot, file);
}

function resolveFile(candidate) {
  if (extname(candidate) && existsSync(candidate)) return candidate;

  for (const extension of allowedExtensions) {
    if (existsSync(`${candidate}${extension}`)) return `${candidate}${extension}`;
  }
  for (const extension of allowedExtensions) {
    const index = resolve(candidate, `index${extension}`);
    if (existsSync(index)) return index;
  }
  return null;
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith("@/")) {
    return resolveFile(resolve(hostedSourceRoot, specifier.slice(2)));
  }
  if (specifier === "@workspace/api-client-react/custom-fetch") {
    return resolveFile(resolve(apiClientRoot, "custom-fetch"));
  }
  if (specifier === "@workspace/api-client-react") {
    return resolveFile(resolve(apiClientRoot, "index"));
  }
  if (specifier.startsWith("@lib/")) {
    return resolveFile(resolve(sharedLibraryRoot, specifier.slice(5)));
  }
  if (specifier.startsWith(".")) {
    return resolveFile(resolve(fromFile, "..", specifier));
  }
  return null;
}

function isForbiddenPath(file) {
  const normalized = file.replaceAll("\\", "/");
  return forbiddenPathFragments.some((fragment) => normalized.includes(fragment));
}

const visited = new Set();
const violations = [];
const unresolved = [];

function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);

  if (isForbiddenPath(file)) {
    violations.push(`${display(file)} is a server-only owner`);
    return;
  }

  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;

    if (forbiddenSpecifiers.some((forbidden) => specifier === forbidden || specifier.startsWith(`${forbidden}/`))) {
      violations.push(`${display(file)} imports forbidden ${specifier}`);
      continue;
    }

    const target = resolveImport(file, specifier);
    if (target) {
      visit(target);
    } else if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      unresolved.push(`${display(file)} could not resolve ${specifier}`);
    }
  }
}

for (const entrypoint of entrypoints) visit(entrypoint);

if (violations.length || unresolved.length) {
  console.error("Static-client boundary check failed.");
  for (const violation of violations) console.error(`- ${violation}`);
  for (const missing of unresolved) console.error(`- ${missing}`);
  process.exit(1);
}

console.log(`Static-client boundary check passed (${visited.size} client-safe source modules).`);
