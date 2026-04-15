import { Page } from "@playwright/test";

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
