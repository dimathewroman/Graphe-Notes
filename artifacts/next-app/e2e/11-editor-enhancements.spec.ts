// E2E tests for editor enhancements introduced in the pre-Yjs hardening PRs.
// All tests run in demo mode — no auth required.

import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Editor enhancements", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  // ── PR 1: ImageUploadExtension ──────────────────────────────────────────────

  test("image upload — no blob: URLs enter the document", async ({ page }) => {
    // Create a fresh note
    await page.getByTestId("new-note-btn").click();
    await expect(page.locator(".ProseMirror")).toBeVisible();

    // Upload a minimal 1×1 PNG via the toolbar's Attach button.
    // In demo mode onAttachFile returns a mock blob URL almost instantly, which means
    // the imageUpload placeholder appears and is replaced in quick succession.
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

    // Wait for any visible placeholder to disappear (upload resolves quickly in demo mode)
    // — the placeholder may flash too fast to assert its presence, but we can assert absence
    await page.waitForTimeout(500);

    // No blob: URLs should remain in the editor HTML at any point after upload
    const html = await page.locator(".ProseMirror").innerHTML();
    expect(html).not.toMatch(/blob:/);
  });

  // ── PR 3: NodeSelector (turn-into) ─────────────────────────────────────────

  test("NodeSelector converts paragraph to h1, bullet list, and toggle", async ({ page }) => {
    await page.getByTestId("new-note-btn").click();
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Hello world");

    // Should start as a paragraph
    await expect(editor.locator("p").filter({ hasText: "Hello world" })).toBeVisible();

    // Convert to Heading 1
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Heading 1" }).click();
    await expect(editor.locator("h1").filter({ hasText: "Hello world" })).toBeVisible();

    // Convert to Bullet List
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Bullet List" }).click();
    await expect(editor.locator("ul li").filter({ hasText: "Hello world" })).toBeVisible();

    // Convert to Toggle block
    await page.getByTestId("toolbar-node-selector-btn").click();
    await page.getByRole("menuitem", { name: "Toggle" }).click();
    await expect(editor.locator("[data-type='details']")).toBeVisible();
  });

  // ── PR 3: Toggle block open/close ──────────────────────────────────────────

  test("toggle block collapses and expands content via the chevron button", async ({ page }) => {
    await page.getByTestId("new-note-btn").click();
    const editor = page.locator(".ProseMirror");
    await editor.click();

    // Insert a toggle block via slash command
    await page.keyboard.type("/Toggle");
    await expect(page.locator("[data-testid='slash-command-menu']")).toBeVisible();
    await page.keyboard.press("Enter");

    // Type a summary title
    await page.keyboard.type("My Toggle");

    // Content area should be visible by default (toggle starts open)
    const detailsContent = editor.locator("[data-type='detailsContent']");
    await expect(detailsContent).toBeVisible();

    // Click the chevron button to collapse
    const toggleBtn = editor.locator("[data-type='details'] > button").first();
    await toggleBtn.click();

    // Content should now be hidden
    await expect(detailsContent).not.toBeVisible();

    // Click again to expand
    await toggleBtn.click();
    await expect(detailsContent).toBeVisible();
  });

  // ── PR 4: Image resize ────────────────────────────────────────────────────

  test("image resize handle updates image width on drag", async ({ page }) => {
    await page.getByTestId("new-note-btn").click();
    const editor = page.locator(".ProseMirror");
    await editor.click();

    // Insert an image via the URL popover
    await page.getByTitle("Insert image from URL").click();
    await page.getByPlaceholder("https://").fill("https://picsum.photos/400/300");
    await page.keyboard.press("Enter");

    // Wait for the image to appear
    const img = editor.locator("img").first();
    await expect(img).toBeVisible({ timeout: 5000 });

    // Hover to reveal resize handles
    await img.hover();
    const rightHandle = page.locator("[data-testid='resize-handle-right']").first();
    await expect(rightHandle).toBeVisible({ timeout: 3000 });

    // Record initial width
    const box = await img.boundingBox();
    expect(box).not.toBeNull();
    const initialWidth = box!.width;

    // Drag the right handle 100px to the right
    const handleBox = await rightHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    const hx = handleBox!.x + handleBox!.width / 2;
    const hy = handleBox!.y + handleBox!.height / 2;
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx + 100, hy, { steps: 10 });
    await page.mouse.up();

    // Image width should have increased
    const newBox = await img.boundingBox();
    expect(newBox!.width).toBeGreaterThan(initialWidth + 50);
  });
});
