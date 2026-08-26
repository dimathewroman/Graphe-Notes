import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const read = (relativePath) => {
  const path = resolve(repositoryRoot, relativePath);
  if (!existsSync(path)) throw new Error(`Missing required Capacitor foundation file: ${relativePath}`);
  return readFileSync(path, "utf8");
};
const requireMatch = (source, pattern, description) => {
  if (!pattern.test(source)) throw new Error(`Capacitor foundation check failed: ${description}`);
};
const rejectMatch = (source, pattern, description) => {
  if (pattern.test(source)) throw new Error(`Capacitor foundation check failed: ${description}`);
};

try {
  const packageJson = JSON.parse(read("package.json"));
  const expectedPackages = {
    "@capacitor/app": "8.1.1",
    "@capacitor/core": "8.5.0",
    "@capacitor/android": "8.5.0",
    "@capacitor/cli": "8.5.0",
    "@capacitor/ios": "8.5.0",
  };
  for (const [name, version] of Object.entries(expectedPackages)) {
    const actual = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
    if (actual !== version) throw new Error(`${name} must be pinned to ${version}, found ${actual ?? "none"}`);
  }

  const config = read("capacitor.config.ts");
  requireMatch(config, /appId:\s*["']com\.leridian\.graphe["']/u, "app ID is not com.leridian.graphe");
  requireMatch(config, /appName:\s*["']Graphe Notes["']/u, "app name is not Graphe Notes");
  requireMatch(config, /webDir:\s*["']artifacts\/static-client\/out["']/u, "webDir is not the static-client output");
  rejectMatch(config, /\bserver\s*:/u, "must not configure a Capacitor server override");
  rejectMatch(config, /allowMixedContent|cleartext|allowNavigation/u, "must not weaken WebView navigation or transport security");

  const scripts = packageJson.scripts ?? {};
  requireMatch(scripts["build:mobile-web"] ?? "", /build:static-client/u, "mobile build does not use the static-client build");
  requireMatch(scripts["cap:sync"] ?? "", /build:mobile-web/u, "Capacitor sync does not rebuild the static bundle");
  requireMatch(scripts["cap:sync"] ?? "", /cap sync/u, "Capacitor sync script is missing");
  requireMatch(scripts["android:build"] ?? "", /cap build android/u, "Android build script is missing");
  requireMatch(scripts["ios:build"] ?? "", /DEVELOPER_DIR=\/Applications\/Xcode-beta\.app\/Contents\/Developer/u, "iOS build does not select Xcode-beta per command");
  requireMatch(scripts["ios:build"] ?? "", /iphonesimulator/u, "iOS build does not target the simulator SDK");

  const androidBuild = read("android/app/build.gradle");
  requireMatch(androidBuild, /namespace\s*=\s*["']com\.leridian\.graphe["']/u, "Android namespace differs");
  requireMatch(androidBuild, /applicationId\s+["']com\.leridian\.graphe["']/u, "Android application ID differs");
  const androidManifest = read("android/app/src/main/AndroidManifest.xml");
  requireMatch(androidManifest, /android:scheme="graphe"/u, "Android graphe URL scheme is missing");
  rejectMatch(androidManifest, /usesCleartextTraffic="true"/u, "Android cleartext traffic is enabled");

  const iosInfo = read("ios/App/App/Info.plist");
  requireMatch(iosInfo, /<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/u, "iOS bundle identifier wiring is missing");
  requireMatch(iosInfo, /<key>CFBundleDisplayName<\/key>\s*<string>Graphe Notes<\/string>/u, "iOS display name differs");
  requireMatch(iosInfo, /<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>graphe<\/string>/u, "iOS graphe URL scheme is missing");
  rejectMatch(iosInfo, /NSAllowsArbitraryLoads\s*<\/key>\s*<true\/>/u, "iOS arbitrary loads are enabled");

  const iosProject = read("ios/App/App.xcodeproj/project.pbxproj");
  requireMatch(iosProject, /PRODUCT_BUNDLE_IDENTIFIER = com\.leridian\.graphe;/u, "iOS bundle ID differs");
  console.log("Capacitor foundation check passed (identity, static sync input, hardened transport, and native URL schemes).");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
