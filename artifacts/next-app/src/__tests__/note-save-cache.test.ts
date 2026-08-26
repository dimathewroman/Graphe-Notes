import { describe, expect, it } from "vitest";
import {
  applyAuthoritativeNoteSaveToCache,
  NoteSaveResponseFence,
} from "@/lib/note-save-cache";

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

  it("keeps the A2 cache and revision when A2 responds before late A1", () => {
    let noteCache: unknown = { id: 7, updatedAt: "r0" };
    let listCache: unknown = [{ id: 7, title: "old", updatedAt: "r0" }];
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
    const fence = new NoteSaveResponseFence();
    const session = "11111111-1111-4111-8111-111111111111";
    let authoritativeRevision = "r0";
    const applyResponse = (
      sequence: number,
      savedNote: {
        id: number;
        title: string;
        content: string;
        updatedAt: string;
      },
    ) => {
      if (
        fence.accepts(savedNote.id, {
          saveSessionId: session,
          saveSequence: sequence,
        })
      ) {
        applyAuthoritativeNoteSaveToCache(queryClient, savedNote);
        authoritativeRevision = savedNote.updatedAt;
      }
    };

    applyResponse(2, { id: 7, title: "A2", content: "A2", updatedAt: "r2" });
    applyResponse(1, { id: 7, title: "A1", content: "A1", updatedAt: "r1" });

    expect(noteCache).toEqual({
      id: 7,
      title: "A2",
      content: "A2",
      updatedAt: "r2",
    });
    expect(listCache).toEqual([{ id: 7, title: "A2", updatedAt: "r2" }]);
    expect(authoritativeRevision).toBe("r2");
  });
});
