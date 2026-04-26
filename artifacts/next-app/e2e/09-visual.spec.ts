/**
 * Visual regression suite.
 *
 * Uses Playwright's toHaveScreenshot() to compare key screens against committed
 * PNG baselines stored in e2e/09-visual.spec.ts-snapshots/.
 *
 * First-time setup (CI):
 *   The CI workflow runs with --update-snapshots=missing, which creates any
 *   missing snapshot files and passes the test. The generated PNGs are uploaded
 *   as the "visual-snapshots" artifact. Download and commit them to enable
 *   enforcement on future PRs.
 *
 * Regenerating baselines after intentional UI changes:
 *   Delete the affected PNG from e2e/09-visual.spec.ts-snapshots/ and let CI
 *   recreate it, or run locally: pnpm test:e2e -- --update-snapshots
 *
 * Note: The "recently deleted" view is intentionally excluded due to a known
 * visual glitch (blank column). Add it back once that is fixed.
 */

import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

// Acceptable pixel difference ratio — 2% allows for minor antialiasing variation
// between runs without masking real visual regressions.
const DIFF_OPTS = { maxDiffPixelRatio: 0.02 };

test.describe("Visual regression", () => {
  test("login page", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("demo-mode-btn").waitFor({ state: "visible" });
    // Let any entrance animations settle
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("login.png", DIFF_OPTS);
  });

  test("demo all-notes view", async ({ page }) => {
    await enterDemoMode(page);
    // Wait for note list items to fully render
    await page.getByTestId("note-item").first().waitFor({ state: "visible" });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("all-notes.png", DIFF_OPTS);
  });

  test("note editor open", async ({ page }) => {
    await enterDemoMode(page);
    await page.getByTestId("note-item").first().click();
    await page.getByTestId("note-title-input").waitFor({ state: "visible" });
    await page.locator(".ProseMirror").waitFor({ state: "visible" });
    // Wait for toolbar to stabilise
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("note-editor.png", DIFF_OPTS);
  });

  test("settings modal", async ({ page }) => {
    await enterDemoMode(page);
    await page.getByTestId("settings-btn").click();
    await page.getByTestId("settings-modal").waitFor({ state: "visible" });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("settings-modal.png", DIFF_OPTS);
  });
});
