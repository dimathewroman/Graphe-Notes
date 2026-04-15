import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Quick Bits", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("navigate to Quick Bits — list loads with demo data", async ({ page }) => {
    // Click Quick Bits in the sidebar
    await page.getByTestId("nav-quickbits").click();

    // The Quick Bits list header should appear (use heading role to avoid
    // matching the sidebar nav label at the same time)
    await expect(page.getByRole("heading", { name: "Quick Bits" })).toBeVisible();

    // Demo data includes pre-seeded Quick Bits
    const items = page.getByTestId("quickbit-item");
    await expect(items.first()).toBeVisible();
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test("new Quick Bit button is visible (disabled in demo mode)", async ({ page }) => {
    await page.getByTestId("nav-quickbits").click();

    const btn = page.getByTestId("new-quickbit-btn");
    await expect(btn).toBeVisible();
    // In demo mode the button is disabled
    await expect(btn).toBeDisabled();
  });

  test("clicking a Quick Bit selects it", async ({ page }) => {
    await page.getByTestId("nav-quickbits").click();

    const firstItem = page.getByTestId("quickbit-item").first();
    await firstItem.click();

    // After clicking, the item should gain the active/selected styling
    // (border-l-primary class indicates selected state)
    await expect(firstItem).toHaveClass(/border-l-primary/);
  });
});
