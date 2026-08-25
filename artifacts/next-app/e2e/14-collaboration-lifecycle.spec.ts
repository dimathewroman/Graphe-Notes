import { test, expect, type Page } from "@playwright/test";
import { enterDemoMode } from "./helpers";

const DATABASE_PREFIX = "graphe-collaboration:graphe-yjs:v1:demo:note:";

async function demoDocumentDatabase(page: Page): Promise<string> {
  await expect
    .poll(async () =>
      page.evaluate(async (prefix) => {
        const databases = await indexedDB.databases();
        return (
          databases
            .map((database) => database.name ?? "")
            .find((name) => name.startsWith(prefix)) ?? null
        );
      }, DATABASE_PREFIX),
    )
    .not.toBeNull();

  return page.evaluate(async (prefix) => {
    const databases = await indexedDB.databases();
    return databases
      .map((database) => database.name ?? "")
      .find((name) => name.startsWith(prefix))!;
  }, DATABASE_PREFIX);
}

async function readBaseRevision(
  page: Page,
  databaseName: string,
): Promise<string | null> {
  return page.evaluate(
    async (name) =>
      new Promise<string | null>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("custom", "readonly");
          const read = transaction
            .objectStore("custom")
            .get("base-server-revision");
          read.onerror = () => reject(read.error);
          read.onsuccess = () =>
            resolve(typeof read.result === "string" ? read.result : null);
          transaction.oncomplete = () => database.close();
        };
      }),
    databaseName,
  );
}

async function writeBaseRevision(
  page: Page,
  databaseName: string,
  revision: string,
): Promise<void> {
  await page.evaluate(
    async ({ name, value }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("custom", "readwrite");
          transaction.objectStore("custom").put(value, "base-server-revision");
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
    { name: databaseName, value: revision },
  );
}

test.describe("Yjs note lifecycle", () => {
  test("isolates A/B undo, restores an exact-base draft, and rejects a stale base", async ({
    page,
  }) => {
    await enterDemoMode(page);
    const notes = page.getByTestId("note-item");
    const editor = page.locator(".ProseMirror:visible");
    const localDraftMarker = "LOCAL_YJS_DRAFT_14";

    await notes.nth(0).click();
    await expect(editor).toBeVisible();
    const noteADatabase = await demoDocumentDatabase(page);
    await expect
      .poll(() => readBaseRevision(page, noteADatabase))
      .not.toBeNull();

    await page.context().setOffline(true);
    await editor.click();
    await page.keyboard.type(localDraftMarker);
    await expect(editor).toContainText(localDraftMarker);
    await page.context().setOffline(false);

    await notes.nth(1).click();
    await expect(editor).toContainText("Japan");
    await expect(editor).not.toContainText(localDraftMarker);
    const noteBText = ((await editor.textContent()) ?? "").trim().slice(0, 24);
    expect(noteBText.length).toBeGreaterThan(4);
    const noteBDraftMarker = "NOTE_B_UNDO_REDO_14";
    await editor.click();
    await page.keyboard.type(noteBDraftMarker);
    await expect(editor).toContainText(noteBDraftMarker);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).toContainText(noteBText);
    await expect(editor).not.toContainText(noteBDraftMarker);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(editor).toContainText(noteBDraftMarker);

    await notes.nth(0).click();
    await expect(editor).toContainText(localDraftMarker);

    await page.reload();
    await enterDemoMode(page);
    await page.getByTestId("note-item").nth(0).click();
    await expect(editor).toContainText(localDraftMarker);

    await writeBaseRevision(page, noteADatabase, "2026-08-25T12:34:57.000Z");
    await page.reload();
    await enterDemoMode(page);
    await page.getByTestId("note-item").nth(0).click();
    await expect(editor).not.toContainText(localDraftMarker);
  });
});
