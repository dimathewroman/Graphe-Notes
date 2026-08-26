import { describe, expect, it, vi } from "vitest";
import { PerNoteSaveBuffer } from "@/lib/note-save-buffer";
import { flushPendingNoteSavesOnPageHide } from "@/lib/note-page-lifecycle-save";

describe("page lifecycle note saving", () => {
  it("retains a pending edit when the keepalive request fails", async () => {
    const buffer = new PerNoteSaveBuffer();
    buffer.queue(1, { content: "unsaved" });
    const send = vi.fn(async () => ({ ok: false }));

    const result = await flushPendingNoteSavesOnPageHide(buffer, send);

    expect(result).toBe("error");
    expect(buffer.take(1)).toEqual({ content: "unsaved" });
  });

  it("does not acknowledge a newer edit queued while the request is in flight", async () => {
    const buffer = new PerNoteSaveBuffer();
    buffer.queue(1, { content: "sent" });
    let resolveRequest!: (response: { ok: boolean }) => void;
    const request = new Promise<{ ok: boolean }>((resolve) => {
      resolveRequest = resolve;
    });

    const flushing = flushPendingNoteSavesOnPageHide(buffer, () => request);
    buffer.queue(1, { content: "newer" });
    resolveRequest({ ok: true });

    await expect(flushing).resolves.toBe("pending");
    expect(buffer.take(1)).toEqual({ content: "newer" });
  });

  it("acknowledges every isolated note only after successful responses", async () => {
    const buffer = new PerNoteSaveBuffer();
    buffer.queue(1, { content: "A" });
    buffer.queue(2, { content: "B" });

    const result = await flushPendingNoteSavesOnPageHide(buffer, async () => ({
      ok: true,
    }));

    expect(result).toBe("saved");
    expect(buffer.snapshot()).toEqual([]);
  });
});
