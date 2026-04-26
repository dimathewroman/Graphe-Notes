import { Page, expect } from "@playwright/test";

/**
 * Navigate to the app, enter demo mode, and land on All Notes.
 *
 * The Zustand store initialises with activeFilter: "quickbits", so on a fresh
 * page load the app shows QuickBitList, not NoteList. We click "All Notes"
 * to guarantee a consistent starting state for every test.
 */
export async function enterDemoMode(page: Page) {
  await page.goto("/");
  await page.getByTestId("demo-mode-btn").click();

  // Wait for the sidebar to render (demo banner confirms app is live)
  await page.getByText("You're in demo mode").waitFor({ state: "visible" });

  // Navigate to All Notes so every test starts from the same view
  await page.getByTestId("nav-all-notes").click();

  // Wait for the note list to appear
  await page.getByTestId("note-list").waitFor({ state: "visible" });
}

/**
 * Navigate to the app using a saved auth session (storageState is injected
 * by the "authenticated" Playwright project — no manual login needed).
 *
 * Use in tests under the "authenticated" project only.
 * Capture/refresh the session with: pnpm test:e2e:login
 */
export async function signInAsUser(page: Page) {
  await page.goto("/");
  // storageState loads the Supabase session from playwright/.auth/user.json;
  // wait for the app shell to confirm the token was accepted.
  await expect(page.getByTestId("nav-all-notes")).toBeVisible({ timeout: 15_000 });
}

/**
 * Take a full-page screenshot and return the path.
 * Useful for visual checks when I'm debugging authenticated UI issues.
 *
 * Usage in a test:
 *   const p = await screenshot(page, "note-editor");
 *   // I can then read this file with the Read tool
 */
export async function screenshot(page: Page, name: string): Promise<string> {
  const p = `playwright/.auth/screenshots/${name}-${Date.now()}.png`;
  await page.screenshot({ path: p, fullPage: true });
  return p;
}
