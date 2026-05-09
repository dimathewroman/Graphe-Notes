import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Ordered list nesting cycle", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
    await page.getByTestId("new-note-btn").click();
    await expect(page.locator(".ProseMirror")).toBeVisible();
    await page.locator(".ProseMirror").click();
  });

  test("ordered list cycles decimal → lower-alpha → lower-roman → decimal", async ({
    page,
  }) => {
    const editor = page.locator(".ProseMirror");

    // Type first item and convert to ordered list
    await editor.pressSequentially("First");
    await page.keyboard.press("Control+Shift+7");
    await page.keyboard.press("Enter");

    // Second item, then indent to level 2
    await editor.pressSequentially("Second");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // Third item, indent to level 3
    await editor.pressSequentially("Third");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // Fourth item, indent to level 4
    await editor.pressSequentially("Fourth");
    await page.keyboard.press("Tab");

    // Verify list-style-type at each nesting depth
    const olLevel1 = editor.locator("ol").first();
    const olLevel2 = olLevel1.locator("ol").first();
    const olLevel3 = olLevel2.locator("ol").first();
    const olLevel4 = olLevel3.locator("ol").first();

    await expect(olLevel1).toHaveCSS("list-style-type", "decimal");
    await expect(olLevel2).toHaveCSS("list-style-type", "lower-alpha");
    await expect(olLevel3).toHaveCSS("list-style-type", "lower-roman");
    await expect(olLevel4).toHaveCSS("list-style-type", "decimal");
  });

  test("bullet list nesting is unaffected by ordered list rules", async ({
    page,
  }) => {
    const editor = page.locator(".ProseMirror");

    // Type first item and convert to bullet list
    await editor.pressSequentially("Bullet one");
    await page.keyboard.press("Control+Shift+8");
    await page.keyboard.press("Enter");

    // Second item, indent
    await editor.pressSequentially("Bullet two");
    await page.keyboard.press("Tab");

    const ulLevel1 = editor.locator("ul").first();
    const ulLevel2 = ulLevel1.locator("ul").first();

    await expect(ulLevel1).toHaveCSS("list-style-type", "disc");
    await expect(ulLevel2).toHaveCSS("list-style-type", "disc");
  });
});
