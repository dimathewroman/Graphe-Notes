import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Notes", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("demo notes are pre-loaded in the note list", async ({ page }) => {
    // DEMO_NOTES includes "Welcome to Graphe Notes 👋" as the first note
    const items = page.getByTestId("note-item");
    await expect(items.first()).toBeVisible();
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test("create a note — it appears in the note list", async ({ page }) => {
    const countBefore = await page.getByTestId("note-item").count();

    await page.getByTestId("new-note-btn").click();

    // One more item in the list
    await expect(page.getByTestId("note-item")).toHaveCount(countBefore + 1);

    // New note has the most recent updatedAt so it sorts to the top (above any
    // pinned notes it's still findable by text content)
    await expect(
      page.getByTestId("note-item").filter({ hasText: "Untitled Note" })
    ).toBeVisible();
  });

  test("open a note — editor loads with TipTap content area", async ({ page }) => {
    // Click the first note in the list
    await page.getByTestId("note-item").first().click();

    // Title input should be visible
    await expect(page.getByTestId("note-title-input")).toBeVisible();

    // TipTap renders a .ProseMirror div as the editable content area
    await expect(page.locator(".ProseMirror")).toBeVisible();
  });

  test("delete a note — it is removed from the list", async ({ page }) => {
    const countBefore = await page.getByTestId("note-item").count();

    // Right-click the first note to open the context menu
    await page.getByTestId("note-item").first().click({ button: "right" });

    // Click Delete in the context menu
    await page.getByTestId("context-menu-delete").click();

    // One fewer note in the list
    await expect(page.getByTestId("note-item")).toHaveCount(countBefore - 1);
  });

  test("search for a note by title — shows matching results", async ({ page }) => {
    // "Welcome to Graphe Notes 👋" is a unique demo note title
    await page.getByTestId("note-search-input").fill("Welcome to Graphe");

    // At least one result should be visible
    const results = page.getByTestId("note-item");
    await expect(results.first()).toBeVisible();

    // The first result should include our note title
    await expect(results.first()).toContainText("Welcome to Graphe Notes");
  });

  test("search with no match shows empty state", async ({ page }) => {
    await page.getByTestId("note-search-input").fill("xyzzy_no_match_string");

    // Empty state message replaces the list
    await expect(page.getByText("No notes found")).toBeVisible();
    await expect(page.getByTestId("note-item")).toHaveCount(0);
  });
});
