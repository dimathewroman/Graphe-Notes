import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { verifyCapacitorFoundation } from "./verify-capacitor-foundation.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const fixtureFiles = [
  "package.json",
  "capacitor.config.ts",
  "capacitor.foundation.json",
  "scripts/build-android-debug.sh",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/res/xml/backup_rules.xml",
  "android/app/src/main/res/xml/data_extraction_rules.xml",
  "ios/App/App/Info.plist",
  "ios/App/App.xcodeproj/project.pbxproj",
];

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "graphe-capacitor-foundation-"));
  for (const relativePath of fixtureFiles) cpSync(resolve(repositoryRoot, relativePath), resolve(root, relativePath));
  return root;
}

function mutate(root, relativePath, transform) {
  const path = resolve(root, relativePath);
  writeFileSync(path, transform(readFileSync(path, "utf8")));
}

function rejects(name, change, expectedMessage) {
  const root = fixture();
  try {
    change(root);
    try {
      verifyCapacitorFoundation(root);
    } catch (error) {
      if (expectedMessage && error.message !== expectedMessage) {
        throw new Error(`Verifier rejected ${name} with unexpected diagnostic: ${error.message}`);
      }
      console.log(`✓ rejects ${name}`);
      return;
    }
    throw new Error(`Verifier accepted ${name}`);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

verifyCapacitorFoundation(repositoryRoot);
rejects("wrong canonical identity", (root) => mutate(root, "capacitor.foundation.json", (source) => source.replace("com.leridian.graphe", "com.example.wrong")));
rejects("comment-spoofed identity", (root) => {
  mutate(root, "capacitor.foundation.json", (source) => source.replace("com.leridian.graphe", "com.example.wrong"));
  mutate(root, "capacitor.config.ts", (source) => `${source}\n// appId: "com.leridian.graphe"`);
});
rejects("computed server config", (root) => mutate(root, "capacitor.config.ts", (source) => source.replace("export default foundation satisfies CapacitorConfig;", "export default { ...foundation, [\"server\"]: {} } satisfies CapacitorConfig;")));
rejects("reversed Capacitor sync", (root) => mutate(root, "package.json", (source) => source.replace("pnpm run build:mobile-web && pnpm exec cap sync", "pnpm exec cap sync && pnpm run build:mobile-web")));
rejects("backup reintroduction", (root) => mutate(root, "android/app/src/main/AndroidManifest.xml", (source) => source.replace('android:allowBackup="false"', 'android:allowBackup="true"')));
rejects("provider reintroduction", (root) => mutate(root, "android/app/src/main/AndroidManifest.xml", (source) => source.replace("</application>", '<provider android:name="androidx.core.content.FileProvider" /></application>')));
rejects("cross-syntax comment delimiter smuggling", (root) => mutate(root, "android/app/src/main/AndroidManifest.xml", (source) => source.replace("<application", "/<!---->* usesCleartextTraffic */\n    <application")), "Capacitor foundation check failed: Android cleartext traffic setting is present");
rejects("data-extraction exclusions under the wrong parent", (root) => mutate(root, "android/app/src/main/res/xml/data_extraction_rules.xml", (source) => source.replace(`    </cloud-backup>
    <device-transfer>
        <exclude domain="root" path="." />
    </device-transfer>`, `        <exclude domain="root" path="." />
    </cloud-backup>
    <device-transfer>
    </device-transfer>`)));
rejects("permissive data-extraction include", (root) => mutate(root, "android/app/src/main/res/xml/data_extraction_rules.xml", (source) => source.replace('        <exclude domain="root" path="." />', '        <exclude domain="root" path="." />\n        <include domain="database" path="." />')));
rejects("illegal double-hyphen XML comment", (root) => mutate(root, "android/app/src/main/res/xml/data_extraction_rules.xml", (source) => source.replace("<data-extraction-rules>", "<data-extraction-rules>\n    <!-- invalid -- double-hyphen -->")), "Capacitor foundation check failed: Android data-extraction XML is not well-formed");
rejects("invalid XML declaration", (root) => mutate(root, "android/app/src/main/res/xml/data_extraction_rules.xml", (source) => source.replace('<?xml version="1.0" encoding="utf-8"?>', "<?xml nonsense?>")), "Capacitor foundation check failed: Android data-extraction XML is not well-formed");
rejects("comment-spoofed Android debug helper", (root) => writeFileSync(resolve(root, "scripts/build-android-debug.sh"), `#!/bin/sh
# cd "$(dirname "$0")/../android"
# exec ./gradlew :app:assembleDebug :app:testDebugUnitTest
exit 0
`));
rejects("missing Android scheme", (root) => mutate(root, "android/app/src/main/AndroidManifest.xml", (source) => source.replace('android:scheme="graphe"', 'android:scheme="other"')));
rejects("missing iOS scheme", (root) => mutate(root, "ios/App/App/Info.plist", (source) => source.replace("<string>graphe</string>", "<string>other</string>")));
console.log("Capacitor foundation mutation-negative tests passed.");
