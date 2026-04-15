import { test, expect } from "@playwright/test";

/**
 * Verifies the app boots without JS errors on the main routes.
 * Uses the login screen (no auth needed) and checks for fatal console errors.
 */
test.describe("App loads", () => {
  test("login screen renders without fatal console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Login screen is visible
    await expect(page.getByText("Graphe Notes")).toBeVisible();
    await expect(page.getByText("Continue with Google")).toBeVisible();
    await expect(page.getByTestId("demo-mode-btn")).toBeVisible();

    // Filter out known benign browser/extension noise; fail on real app errors
    const appErrors = consoleErrors.filter(
      (e) =>
        !e.includes("net::ERR_") && // network errors from missing local resources
        !e.includes("favicon") &&
        !e.includes("Extension") &&
        !e.includes("ResizeObserver") // benign browser-level warning
    );
    expect(appErrors, `Unexpected console errors: ${appErrors.join("\n")}`).toHaveLength(0);
  });

  test("demo mode loads the main app shell", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("demo-mode-btn").click();

    // Demo banner confirms the app shell has mounted
    await expect(page.getByText("You're in demo mode")).toBeVisible();

    // Navigate to All Notes (store defaults to quickbits on fresh load)
    await page.getByTestId("nav-all-notes").click();
    await expect(page.getByTestId("note-list")).toBeVisible();
  });
});
