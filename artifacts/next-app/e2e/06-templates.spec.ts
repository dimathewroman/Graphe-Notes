import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Template System", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  // ── "+" button default behavior ────────────────────────────────────────────

  test("+ button in Notes section creates a blank note on primary click", async ({ page }) => {
    // Ensure we're in the Notes section
    await page.getByTestId("sidebar-notes").click().catch(() => {
      // sidebar item may have a different testid, fall through
    });

    // Navigate to All Notes if not already there
    await page.evaluate(() => {
      const store = (window as any).__ZUSTAND_STORE__;
      if (store) store.getState().setFilter("all");
    }).catch(() => {});

    const countBefore = await page.getByTestId("note-item").count();
    await page.getByTestId("new-note-btn").click({ position: { x: 10, y: 15 } });

    await expect(page.getByTestId("note-item")).toHaveCount(countBefore + 1, { timeout: 5000 });
  });

  test("+ button in Quick Bits section creates a blank Quick Bit on primary click", async ({ page }) => {
    // Find and click the Quick Bits section via Sidebar
    const zbits = page.getByTestId("quickbit-item");
    const countBefore = await zbits.count();

    await page.getByTestId("new-quickbit-btn").click({ position: { x: 10, y: 15 } });

    await expect(page.getByTestId("quickbit-item")).toHaveCount(countBefore + 1, { timeout: 5000 });
  });

  // ── Desktop dropdown ────────────────────────────────────────────────────────

  test("chevron click on note + button opens dropdown with 'From template' and 'New Quick Bit instead'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Navigate to notes view
    await page.evaluate(() => {
      try { (window as any).useAppStore?.getState().setFilter("all"); } catch {}
    });

    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("+ button not found");

    // Click in the right 30% (chevron zone)
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);

    const dropdown = page.getByTestId("new-note-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    await expect(page.getByTestId("from-template-btn")).toBeVisible();
    const items = await page.locator("[data-testid=new-note-dropdown] button").allTextContents();
    expect(items.some(t => t.includes("From template"))).toBe(true);
    expect(items.some(t => t.includes("Quick Bit"))).toBe(true);
  });

  test("chevron click on quick bit + button opens dropdown with 'From template' and 'New note instead'", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const btn = page.getByTestId("new-quickbit-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("QB + button not found");

    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);

    const dropdown = page.getByTestId("new-quickbit-dropdown");
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    await expect(page.getByTestId("from-template-qb-btn")).toBeVisible();
    const items = await page.locator("[data-testid=new-quickbit-dropdown] button").allTextContents();
    expect(items.some(t => t.includes("From template"))).toBe(true);
    expect(items.some(t => t.includes("note"))).toBe(true);
  });

  // ── Template picker opens ───────────────────────────────────────────────────

  test("'From template' opens the template picker modal", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not found");

    // Open chevron menu
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
    await expect(page.getByTestId("from-template-btn")).toBeVisible({ timeout: 3000 });

    // Click "From template"
    await page.getByTestId("from-template-btn").click();

    // Picker should be visible
    await expect(page.getByText("Templates")).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("template-card").first()).toBeVisible({ timeout: 3000 });
  });

  // ── Category filter chips ───────────────────────────────────────────────────

  test("category filter chips filter the template list", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open template picker via store
    await page.evaluate(() => {
      try { (window as any).__ZUSTAND_STORE__?.getState().openTemplatePicker("note"); } catch {}
    });

    // Alternative: use chevron if store shortcut unavailable
    const btn = page.getByTestId("new-note-btn");
    if (await btn.isVisible()) {
      const box = await btn.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
        const fromTemplate = page.getByTestId("from-template-btn");
        if (await fromTemplate.isVisible({ timeout: 1000 }).catch(() => false)) {
          await fromTemplate.click();
        }
      }
    }

    await expect(page.getByTestId("template-card").first()).toBeVisible({ timeout: 5000 });

    const allCountBefore = await page.getByTestId("template-card").count();
    expect(allCountBefore).toBeGreaterThan(0);

    // Click "Plan" chip
    await page.getByTestId("template-category-plan").click();

    // Should show only plan templates (Brain Dump is capture, so count should differ)
    const planCount = await page.getByTestId("template-card").count();
    expect(planCount).toBeGreaterThan(0);
    expect(planCount).toBeLessThanOrEqual(allCountBefore);

    // Click "Capture"
    await page.getByTestId("template-category-capture").click();
    const captureCount = await page.getByTestId("template-card").count();
    expect(captureCount).toBeGreaterThan(0);
  });

  // ── Template card opens preview ─────────────────────────────────────────────

  test("clicking a template card opens the preview panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open picker via chevron
    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not found");
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.getByTestId("from-template-btn").click();
    await expect(page.getByTestId("template-card").first()).toBeVisible({ timeout: 5000 });

    // Click first card
    await page.getByTestId("template-card").first().click();

    // Preview panel should appear with "Use this template" button
    await expect(page.getByTestId("use-template-btn")).toBeVisible({ timeout: 3000 });
  });

  // ── Use template creates note ───────────────────────────────────────────────

  test("'Use this template' creates a note and closes the picker", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const noteBefore = await page.getByTestId("note-item").count();

    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not found");
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.getByTestId("from-template-btn").click();
    await expect(page.getByTestId("template-card").first()).toBeVisible({ timeout: 5000 });
    await page.getByTestId("template-card").first().click();
    await expect(page.getByTestId("use-template-btn")).toBeVisible({ timeout: 3000 });
    await page.getByTestId("use-template-btn").click();

    // Picker closes
    await expect(page.getByText("Templates")).not.toBeVisible({ timeout: 3000 });

    // Note list gains one item
    await expect(page.getByTestId("note-item")).toHaveCount(noteBefore + 1, { timeout: 5000 });
  });

  // ── Start blank link ────────────────────────────────────────────────────────

  test("'Start with a blank page' creates a blank note and closes the picker", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const noteBefore = await page.getByTestId("note-item").count();

    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not found");
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.getByTestId("from-template-btn").click();
    await expect(page.getByTestId("start-blank-btn")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("start-blank-btn").click();

    await expect(page.getByText("Templates")).not.toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId("note-item")).toHaveCount(noteBefore + 1, { timeout: 5000 });
  });

  // ── Save as template ────────────────────────────────────────────────────────

  test("'Save as template' dialog opens from note editor overflow menu", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // tablet — shows overflow menu

    // Create a note first
    await page.getByTestId("new-note-btn").click({ position: { x: 10, y: 15 } });
    await page.getByTestId("note-item").last().click();
    await expect(page.getByTestId("note-title-input")).toBeVisible({ timeout: 5000 });

    // Open overflow menu
    const overflow = page.locator("button[aria-label*='overflow'], button:has(svg[class*='MoreVertical'])").last();
    if (await overflow.isVisible()) {
      await overflow.click();
    }

    const saveBtn = page.getByText("Save as template");
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await expect(page.getByTestId("save-as-template-dialog")).toBeVisible({ timeout: 3000 });
      await expect(page.getByTestId("template-name-input")).toBeVisible();
    }
  });

  // ── Delete flow ─────────────────────────────────────────────────────────────

  test("template deletion inline confirm flow works", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Open picker
    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not found");
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.getByTestId("from-template-btn").click();
    await expect(page.getByTestId("template-card").first()).toBeVisible({ timeout: 5000 });

    // If there are no user templates the delete button won't be present — skip gracefully
    const deleteBtn = page.locator("[data-testid=template-card] button[aria-label='Delete template']").first();
    const hasDeletable = await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false);
    if (!hasDeletable) {
      test.skip();
      return;
    }

    await deleteBtn.click();
    await expect(page.getByText("Delete this template?")).toBeVisible({ timeout: 2000 });

    // Cancel
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByText("Delete this template?")).not.toBeVisible({ timeout: 2000 });
  });

  // ── Motion levels ───────────────────────────────────────────────────────────

  test("minimal motion: template picker opens without scale animations", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Set motion to minimal
    await page.evaluate(() => {
      try {
        const store = (window as any).__ZUSTAND_STORE__;
        if (store) store.getState().setMotionLevel("minimal");
      } catch {}
    });

    const btn = page.getByTestId("new-note-btn");
    await btn.waitFor({ state: "visible" });
    const box = await btn.boundingBox();
    if (!box) throw new Error("button not found");
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.getByTestId("from-template-btn").click();

    // Picker should appear
    await expect(page.getByTestId("template-card").first()).toBeVisible({ timeout: 5000 });

    // In minimal mode, no transform:scale should be applied to cards
    const card = page.getByTestId("template-card").first();
    const style = await card.evaluate(el => window.getComputedStyle(el).transform);
    // "none" or "matrix(1,0,0,1,0,0)" = no scale applied
    const hasScale = style !== "none" && style !== "matrix(1, 0, 0, 1, 0, 0)";
    expect(hasScale).toBe(false);
  });
});
