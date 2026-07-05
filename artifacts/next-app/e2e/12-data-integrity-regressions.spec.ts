// RED regression tests for the Phase-1 data-integrity bugs (audit §V1, §V2).
//
// Both are marked `test.fail()`: they encode the CORRECT behavior and fail on
// current master (proving the bug). Playwright reports an expected failure as a
// pass, so CI stays green and Phase 0 can turn on e2e-required enforcement.
// When the Phase-1 fix lands, the test starts passing → `test.fail()` flips to a
// hard failure ("expected to fail but passed"), signalling: remove the
// `test.fail()` line so it becomes a permanent regression gate.
//
// All tests run in demo mode — no auth required.

import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Data integrity regressions", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  // ── V1: shared undo stack corrupts across notes ────────────────────────────
  // One ProseMirror history stack lives for the whole session (the editor is not
  // remounted on note switch; content is swapped via setContent()). Because the
  // switch's setContent() is recorded as an undoable step, pressing Cmd+Z right
  // after switching to note B reverts that step and WIPES note B's editor — and
  // the resulting onUpdate autosaves the blank into note B's row. Fix (Phase
  // 1.1): clear history on each contentKey change so note B starts with an empty
  // history and undo is a no-op.
  //
  // NOTE: the audit theorized this as "note A's content leaks into note B"; at
  // runtime (verified here) the corruption instead manifests as note B being
  // blanked. Either way the roadmap's core condition holds: "note B content
  // unchanged" after an undo-following-a-switch. That is what we assert.
  test("V1: undo right after switching notes must not wipe note B's content", async ({
    page,
  }) => {
    // Fixed in Phase 1.1 (GrapheEditor clears undo history on contentKey change).

    const notes = page.getByTestId("note-item");
    const editor = page.locator(".ProseMirror");

    // Edit note A so the shared history has steps to undo.
    await notes.nth(0).click();
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type("ZZEDITMARKER");
    await expect(editor).toContainText("ZZEDITMARKER");

    // Switch to note B and capture a distinctive slice of its own content.
    await notes.nth(1).click();
    await expect(editor).toBeVisible();
    await expect(editor).not.toContainText("ZZEDITMARKER");
    const bText = ((await editor.textContent()) ?? "").trim().slice(0, 24);
    expect(bText.length).toBeGreaterThan(4);

    // Undo inside note B. Correct behavior: note B's own content is untouched.
    await editor.click();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).toContainText(bText);
  });

  // ── V2: no save flush on tab backgrounding ─────────────────────────────────
  // The autosave is a pure 800ms trailing debounce with no visibilitychange/
  // pagehide flush, so backgrounding (or an iOS tab kill) during the debounce
  // window loses the edit. Fix (Phase 1.2): flush pendingSaveRef on
  // visibilitychange(hidden)/pagehide.
  test("V2: backgrounding the tab flushes a pending save within the debounce window", async ({
    page,
  }) => {
    test.fail(); // TODO(phase-1.2): remove once a flush-on-hide handler exists

    await page.getByTestId("note-item").nth(0).click();
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible();
    await editor.click();

    // One keystroke arms the 800ms debounce; status shows "Saving…".
    await page.keyboard.type("x");
    const status = page.getByTestId("save-status");
    await expect(status).toHaveText(/Saving/);

    // Background the tab BEFORE the 800ms debounce fires.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pagehide"));
    });

    // Correct behavior: the flush persists immediately, well inside the 800ms
    // debounce. Currently no handler exists, so the status stays "Saving…" until
    // the debounce fires ~800ms later — this 250ms assertion is RED on master.
    await expect(status).toHaveText(/Saved/, { timeout: 250 });
  });
});
