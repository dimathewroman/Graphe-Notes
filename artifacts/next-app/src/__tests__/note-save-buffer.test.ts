import { describe, expect, it } from "vitest";
import { PerNoteSaveBuffer } from "@/lib/note-save-buffer";

describe("per-note save buffer", () => {
  it("keeps B out of a failed A retry after an A-save-in-flight → switch/edit-B sequence", () => {
    const buffer = new PerNoteSaveBuffer();

    buffer.queue(1, { content: "A-first" });
    expect(buffer.take(1)).toEqual({ content: "A-first" });

    buffer.queue(2, { content: "B-only" });
    buffer.retry(1, { content: "A-first" });

    expect(buffer.take(2)).toEqual({ content: "B-only" });
    expect(buffer.take(1)).toEqual({ content: "A-first" });
  });

  it("keeps A out of a failed B retry in the reverse order", () => {
    const buffer = new PerNoteSaveBuffer();

    buffer.queue(2, { content: "B-first" });
    expect(buffer.take(2)).toEqual({ content: "B-first" });

    buffer.queue(1, { content: "A-only" });
    buffer.retry(2, { content: "B-first" });

    expect(buffer.take(1)).toEqual({ content: "A-only" });
    expect(buffer.take(2)).toEqual({ content: "B-first" });
  });

  it("drains page-hide saves as isolated note payloads", () => {
    const buffer = new PerNoteSaveBuffer();
    buffer.queue(1, { title: "A", content: "A-content" });
    buffer.queue(2, { title: "B", content: "B-content" });

    expect(buffer.drain()).toEqual([
      { id: 1, data: { title: "A", content: "A-content" } },
      { id: 2, data: { title: "B", content: "B-content" } },
    ]);
    expect(buffer.drain()).toEqual([]);
  });
});
