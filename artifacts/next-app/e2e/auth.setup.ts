import { test as setup, expect, chromium } from "@playwright/test";
import path from "path";
import os from "os";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

// A dedicated Chrome profile that persists between runs.
// On the first run: install the 1Password extension from the Chrome Web Store.
// On every subsequent run: 1Password is already installed and ready to autofill.
const profileDir = path.join(os.homedir(), ".playwright-chrome-profile");

setup("capture auth session", async () => {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: "chrome",
  });

  const page = context.pages()[0] ?? await context.newPage();
  await page.goto("http://localhost:3000");

  console.log("\n──────────────────────────────────────────────────────");
  console.log("  First time only:");
  console.log("  Install 1Password from the Chrome Web Store, then");
  console.log("  sign in to Graphe Notes with Google + 1Password.");
  console.log("");
  console.log("  Subsequent runs:");
  console.log("  1Password is already installed — just sign in.");
  console.log("──────────────────────────────────────────────────────\n");

  // Wait up to 5 minutes for the app shell to appear after OAuth redirect
  await expect(page.getByTestId("nav-all-notes")).toBeVisible({
    timeout: 300_000,
  });

  await context.storageState({ path: authFile });
  await context.close();

  console.log("\n✓ Session saved to playwright/.auth/user.json");
  console.log("  Run pnpm test:e2e:authenticated to use it.\n");
});
