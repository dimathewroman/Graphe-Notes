import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SaxesParser } from "saxes";

const expectedConfig = {
  appId: "com.leridian.graphe",
  appName: "Graphe Notes",
  webDir: "artifacts/static-client/out",
};
const expectedConfigWrapper = `import type { CapacitorConfig } from "@capacitor/cli";
import foundation from "./capacitor.foundation.json";

export default foundation satisfies CapacitorConfig;`;
const expectedAndroidBuildScript = `#!/bin/sh
set -eu

cd "$(dirname "$0")/../android"
exec ./gradlew :app:assembleDebug :app:testDebugUnitTest
`;

function fail(message) {
  throw new Error(`Capacitor foundation check failed: ${message}`);
}

function read(root, relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) fail(`missing required file ${relativePath}`);
  return readFileSync(path, "utf8");
}

function stripComments(source) {
  let active = "";
  let index = 0;
  let lineHasOnlyWhitespace = true;
  let quote = null;

  while (index < source.length) {
    const character = source[index];

    if (quote !== null) {
      active += character;
      if (character === "\\" && index + 1 < source.length) {
        active += source[index + 1];
        index += 2;
        continue;
      }
      if (character === quote) quote = null;
      lineHasOnlyWhitespace = character === "\n" ||
        (lineHasOnlyWhitespace && /\s/u.test(character));
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      active += character;
      lineHasOnlyWhitespace = false;
      index += 1;
      continue;
    }

    const comment = source.startsWith("<!--", index)
      ? { close: "-->", start: index + 4 }
      : source.startsWith("/*", index)
        ? { close: "*/", start: index + 2 }
        : lineHasOnlyWhitespace && source.startsWith("//", index)
          ? { close: "\n", start: index + 2 }
          : null;

    if (comment !== null) {
      const end = source.indexOf(comment.close, comment.start);
      if (end === -1) fail("unterminated comment in native configuration");
      const afterComment = end + comment.close.length;
      for (const commentCharacter of source.slice(index, afterComment)) {
        if (commentCharacter === "\r" || commentCharacter === "\n") {
          active += commentCharacter;
        }
      }
      index = afterComment;
      lineHasOnlyWhitespace = active.endsWith("\n") || lineHasOnlyWhitespace;
      continue;
    }

    active += character;
    lineHasOnlyWhitespace = character === "\n" ||
      (lineHasOnlyWhitespace && /\s/u.test(character));
    index += 1;
  }

  return active;
}

function equalJson(actual, expected, description) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(description);
}

function attributes(fragment) {
  const values = new Map();
  for (const match of fragment.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gu)) {
    values.set(match[1], match[3]);
  }
  return values;
}

function parseXmlDocument(source) {
  const roots = [];
  const stack = [];
  const parser = new SaxesParser();

  parser.on("opentag", (tag) => {
    const element = {
      name: tag.name,
      attributes: new Map(Object.entries(tag.attributes)),
      children: [],
    };

    if (stack.length === 0) roots.push(element);
    else stack.at(-1).children.push(element);
    stack.push(element);
  });
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.on("text", (text) => {
    if (!/^\s*$/u.test(text)) fail("Android data-extraction XML contains text content");
  });
  parser.on("cdata", () => {
    fail("Android data-extraction XML contains text content");
  });

  try {
    parser.write(source).close();
  } catch {
    fail("Android data-extraction XML is not well-formed");
  }

  if (roots.length !== 1) fail("Android data-extraction XML must contain one root element");

  return roots[0];
}

function plistKeys(source) {
  const keys = [];
  const stack = [];
  let keyText = null;
  const parser = new SaxesParser();

  parser.on("opentag", (tag) => {
    stack.push(tag.name);
    if (tag.name === "key") keyText = "";
  });
  parser.on("text", (text) => {
    if (stack.at(-1) === "key") keyText += text;
  });
  parser.on("cdata", () => {
    if (stack.at(-1) === "key") fail("iOS plist keys must use literal text");
  });
  parser.on("closetag", () => {
    if (stack.pop() === "key") {
      keys.push(keyText);
      keyText = null;
    }
  });

  try {
    parser.write(source).close();
  } catch {
    fail("iOS plist is not well-formed");
  }

  return keys;
}

function hasExactAttributes(element, expected) {
  return element.attributes.size === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => element.attributes.get(key) === value);
}

function xmlElements(source, name) {
  const active = stripComments(source);
  return [...active.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gu"))].map((match) => attributes(match[1]));
}

function hasXmlElement(source, name, expectedAttributes) {
  return xmlElements(source, name).some((element) =>
    Object.entries(expectedAttributes).every(([key, value]) => element.get(key) === value),
  );
}

function gradleAssignments(source, name) {
  return stripComments(source)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${name} `) || line.startsWith(`${name}=`))
    .map((line) => line.replace(new RegExp(`^${name}\\s*=?\\s*`, "u"), "").replace(/["']/gu, "").replace(/;$/u, ""));
}

function plistElementAfterKey(source, key, element) {
  const active = stripComments(source);
  const keyToken = `<key>${key}</key>`;
  const keyIndex = active.indexOf(keyToken);
  if (keyIndex === -1) return null;
  const contentStart = keyIndex + keyToken.length;
  const elementStart = active.indexOf(`<${element}>`, contentStart);
  if (elementStart === -1 || !/^\s*$/u.test(active.slice(contentStart, elementStart))) return null;
  const openTag = `<${element}>`;
  const closeTag = `</${element}>`;
  let depth = 0;
  for (let index = elementStart; index < active.length;) {
    const nextOpen = active.indexOf(openTag, index);
    const nextClose = active.indexOf(closeTag, index);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      index = nextOpen + openTag.length;
    } else {
      depth -= 1;
      index = nextClose + closeTag.length;
      if (depth === 0) return active.slice(elementStart, index);
    }
  }
  return null;
}

function plistStringAfterKey(source, key) {
  const value = plistElementAfterKey(source, key, "string");
  return value?.match(/^<string>([^<]*)<\/string>$/u)?.[1] ?? null;
}

function verifyAndroid(root) {
  const build = read(root, "android/app/build.gradle");
  const namespaces = gradleAssignments(build, "namespace");
  const applicationIds = gradleAssignments(build, "applicationId");
  if (namespaces.length !== 1 || namespaces[0] !== expectedConfig.appId) fail("Android namespace differs");
  if (applicationIds.length !== 1 || applicationIds[0] !== expectedConfig.appId) fail("Android application ID differs");

  const manifest = read(root, "android/app/src/main/AndroidManifest.xml");
  const applications = xmlElements(manifest, "application");
  if (applications.length !== 1) fail("Android manifest must contain one application owner");
  const application = applications[0];
  if (application.get("android:allowBackup") !== "false") fail("Android backup is not fail-closed");
  if (application.get("android:dataExtractionRules") !== "@xml/data_extraction_rules") fail("Android data-extraction rules are not fail-closed");
  if (application.get("android:fullBackupContent") !== "@xml/backup_rules") fail("Android full-backup rules are not fail-closed");
  if (xmlElements(manifest, "provider").length !== 0) fail("Android FileProvider must not be registered");
  if (stripComments(manifest).includes("usesCleartextTraffic")) fail("Android cleartext traffic setting is present");
  if (!hasXmlElement(manifest, "data", { "android:scheme": "graphe" })) fail("Android graphe URL scheme is missing");
  if (existsSync(resolve(root, "android/app/src/main/res/xml/file_paths.xml"))) fail("unused Android broad file-path resource is present");

  const backupRules = read(root, "android/app/src/main/res/xml/backup_rules.xml");
  if (!hasXmlElement(backupRules, "full-backup-content", {}) || !hasXmlElement(backupRules, "exclude", { domain: "root", path: "." })) {
    fail("Android full-backup exclusion is incomplete");
  }
  const extractionRules = parseXmlDocument(read(root, "android/app/src/main/res/xml/data_extraction_rules.xml"));
  if (extractionRules.name !== "data-extraction-rules" || !hasExactAttributes(extractionRules, {})) {
    fail("Android data-extraction root differs");
  }
  const requiredParents = new Map([
    ["cloud-backup", { disableIfNoEncryptionCapabilities: "true" }],
    ["device-transfer", {}],
  ]);
  if (extractionRules.children.length !== requiredParents.size) fail("Android data-extraction parents differ");
  for (const [name, expectedAttributes] of requiredParents) {
    const parents = extractionRules.children.filter((element) => element.name === name);
    if (parents.length !== 1 || !hasExactAttributes(parents[0], expectedAttributes)) {
      fail(`Android ${name} data-extraction section differs`);
    }
    const [exclusion] = parents[0].children;
    if (parents[0].children.length !== 1 || exclusion.name !== "exclude" ||
        !hasExactAttributes(exclusion, { domain: "root", path: "." })) {
      fail(`Android ${name} root data-extraction exclusion is incomplete`);
    }
  }
}

function verifyIos(root) {
  const info = read(root, "ios/App/App/Info.plist");
  if (plistStringAfterKey(info, "CFBundleIdentifier") !== "$(PRODUCT_BUNDLE_IDENTIFIER)") fail("iOS bundle identifier wiring is missing");
  if (plistStringAfterKey(info, "CFBundleDisplayName") !== expectedConfig.appName) fail("iOS display name differs");
  const urlTypes = plistElementAfterKey(info, "CFBundleURLTypes", "array");
  if (!urlTypes) fail("iOS URL-type registration is missing");
  const schemes = plistElementAfterKey(urlTypes, "CFBundleURLSchemes", "array");
  if (!schemes || !/^<array>\s*<string>graphe<\/string>\s*<\/array>$/u.test(schemes)) fail("iOS graphe URL scheme is missing");
  if (plistKeys(info).includes("NSAllowsArbitraryLoads")) fail("iOS arbitrary loads setting is present");

  const project = stripComments(read(root, "ios/App/App.xcodeproj/project.pbxproj"));
  const bundleIds = [...project.matchAll(/^\s*PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/gmu)].map((match) => match[1].trim());
  if (bundleIds.length === 0 || bundleIds.some((value) => value !== expectedConfig.appId)) fail("iOS bundle ID differs");
}

export function verifyCapacitorFoundation(repositoryRoot = resolve(import.meta.dirname, "..")) {
  const packageJson = JSON.parse(read(repositoryRoot, "package.json"));
  const expectedPackages = {
    "@capacitor/app": "8.1.1",
    "@capacitor/core": "8.5.0",
    "@capacitor/android": "8.5.0",
    "@capacitor/cli": "8.5.0",
    "@capacitor/ios": "8.5.0",
  };
  for (const [name, version] of Object.entries(expectedPackages)) {
    const actual = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
    if (actual !== version) fail(`${name} must be pinned to ${version}, found ${actual ?? "none"}`);
  }

  const configWrapper = read(repositoryRoot, "capacitor.config.ts").replace(/\r\n/gu, "\n").trim();
  if (configWrapper !== expectedConfigWrapper) fail("Capacitor config must be the canonical JSON wrapper");
  equalJson(JSON.parse(read(repositoryRoot, "capacitor.foundation.json")), expectedConfig, "effective Capacitor config differs");

  const scripts = packageJson.scripts ?? {};
  if (scripts["build:mobile-web"] !== "pnpm run build:static-client") fail("mobile build script differs");
  if (scripts["cap:sync"] !== "pnpm run build:mobile-web && pnpm exec cap sync") fail("Capacitor sync must build before syncing");
  if (scripts["android:build"] !== "pnpm run cap:sync && sh scripts/build-android-debug.sh") fail("Android build must use the unsigned debug Gradle workflow");
  if (scripts["ios:build"]?.includes("DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer") !== true ||
      scripts["ios:build"]?.includes("iphonesimulator") !== true) {
    fail("iOS build does not select Xcode-beta and the simulator SDK per command");
  }
  const androidBuildScript = read(repositoryRoot, "scripts/build-android-debug.sh");
  if (androidBuildScript.replace(/\r\n/gu, "\n") !== expectedAndroidBuildScript) {
    fail("Android debug build helper is not limited to unsigned app-scoped Gradle checks");
  }

  verifyAndroid(repositoryRoot);
  verifyIos(repositoryRoot);
}

try {
  verifyCapacitorFoundation();
  console.log("Capacitor foundation check passed (effective config, static sync order, hardened native settings, and URL schemes).");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
