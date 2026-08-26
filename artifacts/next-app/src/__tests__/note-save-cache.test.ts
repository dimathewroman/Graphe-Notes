import { describe, expect, it } from "vitest";
import { applyAuthoritativeNoteSaveToCache } from "@/lib/note-save-cache";

describe("authoritative note save cache", () => {
  it("replaces the note cache and patches every list from the returned server revision", () => {
    let noteCache: unknown;
    let listCache: unknown = [
      { id: 7, title: "old", contentText: "old text", updatedAt: "r0" },
      { id: 8, title: "other", contentText: "other", updatedAt: "r0" },
    ];
    const queryClient = {
      setQueryData: (_key: readonly unknown[], value: unknown) => {
        noteCache = value;
      },
      setQueriesData: (
        _filters: { queryKey: readonly unknown[] },
        updater: (old: unknown) => unknown,
      ) => {
        listCache = updater(listCache);
      },
    };
    const savedNote = {
      id: 7,
      title: "server title",
      content: "<p>server HTML</p>",
      contentText: "server text",
      updatedAt: "r2",
      tags: ["server"],
    };

    applyAuthoritativeNoteSaveToCache(queryClient, savedNote);

    expect(noteCache).toEqual(savedNote);
    expect(listCache).toEqual([
      {
        id: 7,
        title: "server title",
        contentText: "server text",
        updatedAt: "r2",
        tags: ["server"],
      },
      { id: 8, title: "other", contentText: "other", updatedAt: "r0" },
    ]);
  });
});
