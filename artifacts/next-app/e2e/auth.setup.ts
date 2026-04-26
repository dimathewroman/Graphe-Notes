import { test as setup, expect, chromium } from "@playwright/test";
import path from "path";
import os from "os";
import { execSync } from "child_process";

// process.cwd() = artifacts/next-app/ when Playwright runs — more reliable
// than __dirname which can resolve differently in Playwright's TS runner.
const authFile = path.join(process.cwd(), "playwright", ".auth", "user.json");

const chromeUserData = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome"
);

function isChromeRunning(): boolean {
  try {
    execSync('pgrep -x "Google Chrome"', { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

setup("capture auth session", async () => {
  // Must be the first line — overrides the global 60s cap before any awaits.
  setup.setTimeout(300_000);

  if (isChromeRunning()) {
    throw new Error(
      "\n\n  Chrome is still running.\n" +
      "  Run:  pkill -x 'Google Chrome'  then re-run this script.\n"
    );
  }

  const context = await chromium.launchPersistentContext(chromeUserData, {
    headless: false,
    channel: "chrome",
    args: ["--profile-directory=Default"],
    // Playwright adds --disable-extensions by default which hides 1Password.
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("http://localhost:3000");

  console.log("\n──────────────────────────────────────────────────────");
  console.log("  Sign in with Google — 1Password will autofill.");
  console.log("  Chrome will close automatically once you're in.");
  console.log("──────────────────────────────────────────────────────\n");

  await expect(page.getByTestId("nav-all-notes")).toBeVisible({
    timeout: 270_000,
  });

  await context.storageState({ path: authFile });
  await context.close();

  console.log("\n✓ Session saved. You can reopen Chrome now.");
  console.log(`  Saved to: ${authFile}\n`);
});
