import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

/**
 * Auth capture — opens a headed browser for you to sign in with 1Password.
 *
 * Run with:  pnpm test:e2e:login
 *
 * 1. A Chrome window will open at http://localhost:3000
 * 2. Click "Continue with Google" and sign in with 1Password
 * 3. Once the app shell loads the session is saved automatically
 * 4. Close the browser — done. Session is valid for hours/days.
 *
 * Re-run this script whenever "Session expired" errors appear in tests.
 */
setup("capture auth session", async ({ page }) => {
  await page.goto("/");

  console.log("\n──────────────────────────────────────────────");
  console.log("  Sign in to Graphe Notes in the browser.");
  console.log("  Use 1Password to fill your Google credentials.");
  console.log("  This window will close automatically once done.");
  console.log("──────────────────────────────────────────────\n");

  // Wait up to 5 minutes for the user to complete OAuth
  await expect(page.getByTestId("nav-all-notes")).toBeVisible({
    timeout: 300_000,
  });

  await page.context().storageState({ path: authFile });

  console.log(`\n✓ Session saved to playwright/.auth/user.json`);
  console.log("  Run pnpm test:e2e:authenticated to use it.\n");
});
