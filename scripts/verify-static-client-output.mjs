import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredFiles = [
  "index.html",
  "auth/callback.html",
  "graphe_minimalist_1773640203523.png",
];
const requiredUtilities = ["min-h-screen", "flex"];
const rawTailwindDirectives = ["@apply", '@import "tailwindcss"', "@tailwind"];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

export function verifyStaticClientOutput(repositoryRoot = resolve(import.meta.dirname, "..")) {
  const outputRoot = resolve(repositoryRoot, "artifacts/static-client/out");
  for (const file of requiredFiles) {
    if (!existsSync(resolve(outputRoot, file))) {
      throw new Error(`Static-client output check failed: missing ${file}.`);
    }
  }

  const outputFiles = filesUnder(outputRoot);
  const cssFiles = outputFiles.filter((file) => file.endsWith(".css"));
  const compiledCss = cssFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  if (cssFiles.length === 0) {
    throw new Error("Static-client output check failed: no exported stylesheet.");
  }
  const rawDirective = rawTailwindDirectives.find((directive) => compiledCss.includes(directive));
  if (rawDirective) {
    throw new Error(`Static-client output check failed: CSS retains raw ${rawDirective}.`);
  }
  const missingUtility = requiredUtilities.find(
    (utility) => !compiledCss.includes(`.${utility}{`),
  );
  if (missingUtility) {
    throw new Error(`Static-client output check failed: CSS is missing compiled .${missingUtility}.`);
  }

  const forbiddenCodeMarkers = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "@workspace/db",
    "@sentry/node",
    "default-stylesheet.css",
  ];
  for (const file of outputFiles) {
    if (!/\.(?:html|js|json|txt)$/u.test(file)) continue;
    const contents = readFileSync(file, "utf8");
    const marker = forbiddenCodeMarkers.find((candidate) => contents.includes(candidate));
    if (marker) {
      throw new Error(`Static-client output check failed: ${file} contains ${marker}.`);
    }

    // Next's client runtime retains generic image-loader code, but exported HTML
    // must never reference the hosted optimizer endpoint.
    if (file.endsWith(".html") && contents.includes("/_next/image")) {
      throw new Error(`Static-client output check failed: ${file} references /_next/image.`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    verifyStaticClientOutput();
    console.log("Static-client output check passed (compiled Tailwind CSS, logo, required pages, and no optimized-image/server markers).");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
