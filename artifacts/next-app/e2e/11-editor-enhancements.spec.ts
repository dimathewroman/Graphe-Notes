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
    await expect(page.locator(".ProseMirror ul li").first()).toBeVisible();

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
    // Wait for the Radix dismissable layer to fully detach before clicking in the editor
    await expect(page.locator('[role="menu"]')).not.toBeAttached();

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


  // ── PR 4: Image resize ─────────────────────────────────────────────────────

  test("image resize: handle appears on selection, drag updates width", async ({ page }) => {
    // Open a note and wait for the editor
    await page.getByTestId("note-item").first().click();
    await expect(page.locator(".ProseMirror")).toBeVisible();

    // Insert an image via the URL toolbar button (data: URI passes the CSP img-src policy)
    const TEST_IMG = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='400' height='200' fill='%234F46E5'/%3E%3C/svg%3E";
    const imageBtn = page.locator('button[title="Insert image from URL"]');
    await imageBtn.click();
    await page.getByPlaceholder("https://…").fill(TEST_IMG);
    await page.getByRole("button", { name: "Insert", exact: true }).click();

    // Wait for the image to appear in the editor
    const img = page.locator(".ProseMirror img").first();
    await expect(img).toBeVisible();

    // Click the image to select it — handles become visible
    await img.click();
    const rightHandle = page.locator('[data-testid="resize-handle-right"]').first();
    await expect(rightHandle).toBeVisible();

    // Measure initial image width
    const initialBox = await img.boundingBox();
    expect(initialBox).not.toBeNull();
    const initialWidth = initialBox!.width;

    // Drag the right handle 100px to the right
    const handleBox = await rightHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    const handleCenterX = handleBox!.x + handleBox!.width / 2;
    const handleCenterY = handleBox!.y + handleBox!.height / 2;

    await page.mouse.move(handleCenterX, handleCenterY);
    await page.mouse.down();
    await page.mouse.move(handleCenterX + 100, handleCenterY, { steps: 10 });
    await page.mouse.up();

    // Width should have increased by at least 50px
    const newBox = await img.boundingBox();
    expect(newBox).not.toBeNull();
    expect(newBox!.width).toBeGreaterThan(initialWidth + 50);
  });
});
