// E2E tests for editor enhancements introduced in the pre-Yjs hardening PRs.
// All tests run in demo mode — no auth required.
// Tests 2–4 (NodeSelector, toggle, image resize) are added on their respective
// feature branches (PRs 3 and 4) and are not present here.

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
});
