import { test, expect } from "@playwright/test";
import { enterDemoMode, enterDemoModeOnMobile } from "../e2e/helpers";

async function enterDemoModeForProject(
  page: Parameters<typeof enterDemoMode>[0],
  projectName: string,
) {
  if (projectName.startsWith("smoke-mobile-")) {
    await enterDemoModeOnMobile(page);
    return;
  }

  await enterDemoMode(page);
}

test.describe("Cross-platform smoke", () => {
  test("boots the app and enters demo mode", async ({ page }, testInfo) => {
    await enterDemoModeForProject(page, testInfo.project.name);

    await expect(page.getByText("You're in demo mode")).toBeVisible();
    await expect(page.getByTestId("note-list")).toBeVisible();
    await expect(page.getByTestId("note-item").first()).toBeVisible();
  });

  test("opens a note and edits its title", async ({ page }, testInfo) => {
    await enterDemoModeForProject(page, testInfo.project.name);

    await page.getByTestId("note-item").first().click();
    const title = page.getByTestId("note-title-input");
    await expect(title).toBeVisible();

    await title.fill("Cross-platform smoke note");
    await expect(title).toHaveValue("Cross-platform smoke note");
  });
});
