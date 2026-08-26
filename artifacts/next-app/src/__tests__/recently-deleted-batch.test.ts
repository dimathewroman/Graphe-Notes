import { describe, expect, it, vi } from "vitest";
import { deleteRecentlyDeletedBatch } from "@/lib/recently-deleted-batch";

describe("empty Recently Deleted batch", () => {
  it("reconciles each successful deletion before a later failure and retries only what remains", async () => {
    const visible = new Set([1, 2]);
    let failSecond = true;
    const deleteOne = vi.fn(async (id: number) => {
      if (id === 2 && failSecond) throw new Error("delete failed");
    });
    const reconcile = vi.fn(async (id: number) => {
      visible.delete(id);
    });

    await expect(
      deleteRecentlyDeletedBatch([...visible], deleteOne, reconcile),
    ).rejects.toThrow("delete failed");
    expect([...visible]).toEqual([2]);

    failSecond = false;
    await deleteRecentlyDeletedBatch([...visible], deleteOne, reconcile);

    expect([...visible]).toEqual([]);
    expect(deleteOne.mock.calls).toEqual([[1], [2], [2]]);
    expect(reconcile.mock.calls).toEqual([[1], [2]]);
  });
});
