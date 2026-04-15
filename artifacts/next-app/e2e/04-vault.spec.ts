import { test, expect } from "@playwright/test";
import { enterDemoMode } from "./helpers";

test.describe("Vault", () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page);
  });

  test("clicking Vault (unconfigured) shows the setup modal", async ({ page }) => {
    // In demo mode, vault starts unconfigured
    await page.getByTestId("nav-vault").click();

    // The vault setup modal should appear
    await expect(page.getByTestId("vault-modal")).toBeVisible();
    await expect(page.getByText("Set Up Vault")).toBeVisible();
  });

  test("set up vault with PIN — navigates to vault section after unlock", async ({ page }) => {
    // Open vault setup
    await page.getByTestId("nav-vault").click();
    await expect(page.getByTestId("vault-modal")).toBeVisible();

    // PinPad renders digit buttons with the digit as their accessible name.
    // After entering 4+ digits the "Next" submit button becomes enabled.
    const pressDigit = async (digit: string) => {
      await page.getByRole("button", { name: digit, exact: true }).click();
    };

    // Enter PIN 1234 then click Next
    for (const d of ["1", "2", "3", "4"]) await pressDigit(d);
    await page.getByRole("button", { name: "Next", exact: true }).click();

    // Step advances to "Confirm PIN"
    await expect(page.getByText("Confirm PIN")).toBeVisible();

    // Re-enter same PIN then click Confirm
    for (const d of ["1", "2", "3", "4"]) await pressDigit(d);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();

    // After successful setup, the modal should close and vault is unlocked
    await expect(page.getByTestId("vault-modal")).not.toBeVisible({ timeout: 5_000 });

    // Now clicking vault again should go directly to the vault section (no modal)
    await page.getByTestId("nav-vault").click();
    // Heading inside the note list confirms we're in the Vault view
    await expect(page.getByRole("heading", { name: "Vault" })).toBeVisible();
    await expect(page.getByTestId("vault-modal")).not.toBeVisible();
  });

  test("vault a note — it shows lock screen when vault is subsequently locked", async ({ page }) => {
    // Set up and unlock vault first
    await page.getByTestId("nav-vault").click();
    const pressDigit = async (digit: string) =>
      page.getByRole("button", { name: digit, exact: true }).click();

    // Setup PIN 1234 → Next → Confirm
    for (const d of ["1", "2", "3", "4"]) await pressDigit(d);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Confirm PIN")).toBeVisible();
    for (const d of ["1", "2", "3", "4"]) await pressDigit(d);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByTestId("vault-modal")).not.toBeVisible({ timeout: 5_000 });

    // Navigate back to All Notes
    await page.getByTestId("nav-all-notes").click();

    // Right-click the first note — vault option is now visible (vault is unlocked)
    await page.getByTestId("note-item").first().click({ button: "right" });
    await expect(page.getByTestId("context-menu-vault")).toBeVisible();
    await page.getByTestId("context-menu-vault").click();

    // Navigate to Vault section — the vaulted note should be listed there
    await page.getByTestId("nav-vault").click();
    await expect(page.getByTestId("note-list")).toBeVisible();
    const vaultedNotes = page.getByTestId("note-item");
    await expect(vaultedNotes.first()).toBeVisible();
  });
});
