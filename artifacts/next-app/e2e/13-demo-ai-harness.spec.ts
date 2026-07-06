// Demo-AI harness end-to-end. AI is normally disabled in demo mode, so this is
// the FIRST automated coverage of the AI-action → editor-insert path. It runs
// only when NEXT_PUBLIC_ENABLE_DEMO_AI=1 (set by the CI workflow); the mock never
// contacts a real provider, so the result is deterministic. This is the harness
// the streaming work builds on — the same test will later assert progressive
// (token-by-token) insertion.

import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

const HARNESS_ON = process.env.NEXT_PUBLIC_ENABLE_DEMO_AI === "1";

test.describe("Demo-AI harness", () => {
  test.skip(!HARNESS_ON, "requires NEXT_PUBLIC_ENABLE_DEMO_AI=1 (dev/CI harness)");

  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("a proofread action inserts the mock result into the editor", async ({ page }) => {
    await page.getByTestId("new-note-btn").click();
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible();

    // Type a line, then select it to raise the AI selection menu.
    await editor.click();
    await page.keyboard.type("this is som text to proofred");
    await page.keyboard.press("ControlOrMeta+a");

    // Menu appears above the selection and becomes interactive after ~200ms;
    // Playwright waits for the button to be actionable.
    const group = page.getByTestId("ai-group-improve-writing");
    await expect(group).toBeVisible({ timeout: 5000 });
    await group.click();
    await page.getByTestId("ai-action-proofread").click();

    // The mock replaces the selection with a deterministic canned result
    // (proofread is a rewrite action). No real AI was involved.
    await expect(editor).toContainText("Mock AI response for proofread.", { timeout: 5000 });
  });
});
