import { test as setup, expect, chromium } from "@playwright/test";
import path from "path";
import os from "os";
import fs from "fs";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

// Uses your real Chrome Default profile — 1Password is already installed.
// Chrome must be fully quit (Cmd+Q) before running this script because macOS
// Chrome refuses to share a profile with another running instance.
// Reopen Chrome normally after the session is saved.
const chromeUserData = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome"
);

setup("capture auth session", async () => {
  // Warn early if Chrome's lock file is present (Chrome is still running)
  const lockFile = path.join(chromeUserData, "Default", "LOCK");
  if (fs.existsSync(lockFile)) {
    throw new Error(
      "\n\n  Chrome is still running. Quit Chrome completely (Cmd+Q) then re-run.\n"
    );
  }

  const context = await chromium.launchPersistentContext(chromeUserData, {
    headless: false,
    channel: "chrome",
    args: ["--profile-directory=Default"],
  });

  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("http://localhost:3000");

  console.log("\n──────────────────────────────────────────────────────");
  console.log("  Sign in with Google — 1Password will autofill.");
  console.log("  Chrome will close automatically once you're in.");
  console.log("──────────────────────────────────────────────────────\n");

  // Wait up to 5 minutes for the app shell to confirm sign-in succeeded
  await expect(page.getByTestId("nav-all-notes")).toBeVisible({
    timeout: 300_000,
  });

  await context.storageState({ path: authFile });
  await context.close();

  console.log("\n✓ Session saved. You can reopen Chrome now.");
  console.log("  Run pnpm test:e2e:authenticated to use the session.\n");
});
