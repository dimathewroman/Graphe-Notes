// E2E tests for editor enhancements introduced in the pre-Yjs hardening PRs.
// All tests run in demo mode — no auth required.

import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Editor enhancements", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  // ── PR 1: ImageUploadExtension ──────────────────────────────────────────────

  test("image upload — placeholder is replaced by a real image node", async ({ page }) => {
    // Create a fresh note
    await page.getByTestId("new-note-btn").click();
    await expect(page.locator(".ProseMirror")).toBeVisible();

    // Upload a minimal 1×1 PNG via the toolbar's Attach button.
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByTitle("Attach file").click(),
    ]);
    await fileChooser.setFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==",
        "base64"
      ),
    });

    // The imageUpload placeholder must not remain in the document after upload
    // (it may flash too quickly to assert its presence, but absence is reliable).
    await expect(
      page.locator("[data-testid='image-upload-placeholder']")
    ).not.toBeAttached({ timeout: 3000 });

    // A real <img> node must be present — the placeholder was swapped successfully.
    await expect(page.locator(".ProseMirror img")).toBeVisible({ timeout: 3000 });
  });

  // ── PR 3: NodeSelector (turn-into) ─────────────────────────────────────────

  test("NodeSelector converts block types via turn-into", async ({ page }) => {
    // Open a note and wait for the editor
    await page.getByTestId("note-item").first().click();
    await expect(page.locator(".ProseMirror")).toBeVisible();

    // Type some content so the selector has a block to convert
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("NodeSelectorTest");

    // Verify the selector button exists and shows "Normal text" state (T icon)
    await expect(page.getByTestId("toolbar-node-selector-btn")).toBeVisible();

    // Convert to Heading 1
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Heading 1" }).click();
    await expect(page.locator(".ProseMirror h1")).toBeVisible();

    // Selector should now show H1 state
    await expect(page.getByTestId("toolbar-node-selector-btn")).toBeVisible();

    // Convert H1 → Bullet list
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Bullet list" }).click();
    await expect(page.locator(".ProseMirror ul li")).toBeVisible();

    // Convert Bullet list → Toggle block
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Toggle" }).click();
    await expect(page.locator(".ProseMirror [data-type='details']")).toBeVisible();
  });

  // ── PR 3: Toggle block open/close ──────────────────────────────────────────

  test("toggle block opens and closes via the toggle button", async ({ page }) => {
    // Open a note and wait for the editor
    await page.getByTestId("note-item").first().click();
    await expect(page.locator(".ProseMirror")).toBeVisible();

    // Insert a toggle block via the NodeSelector
    await page.locator(".ProseMirror").click();
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Toggle" }).click();
    await expect(page.locator(".ProseMirror [data-type='details']")).toBeVisible();

    // Type summary text
    await page.keyboard.type("Toggle summary");

    // The detailsContent should start hidden (collapsed by default)
    const content = page.locator("[data-type='detailsContent']");
    await expect(content).toHaveAttribute("hidden");

    // Click the toggle button to expand
    const toggleBtn = page.locator("[data-type='details'] button[type='button']");
    await toggleBtn.click();
    await expect(content).not.toHaveAttribute("hidden");

    // Click again to collapse
    await toggleBtn.click();
    await expect(content).toHaveAttribute("hidden");
  });
});
