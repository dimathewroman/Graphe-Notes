import {
  PerNoteSaveBuffer,
  type PendingNoteSaveSnapshot,
} from "./note-save-buffer";

export type PageLifecycleSaveResult = "idle" | "saved" | "pending" | "error";

export type SendPageLifecycleNoteSave = (
  pending: PendingNoteSaveSnapshot,
) => Promise<{ ok: boolean }>;

/**
 * Sends a stable snapshot without surrendering buffer ownership first. A save
 * is acknowledged only after a successful response and only if no newer edit
 * replaced that exact note version while the request was in flight.
 */
export async function flushPendingNoteSavesOnPageHide(
  buffer: PerNoteSaveBuffer,
  send: SendPageLifecycleNoteSave,
): Promise<PageLifecycleSaveResult> {
  const pending = buffer.snapshot();
  if (pending.length === 0) return "idle";

  let failed = false;
  await Promise.all(
    pending.map(async (entry) => {
      try {
        const response = await send(entry);
        if (!response.ok) {
          failed = true;
          return;
        }
        buffer.acknowledge(entry.id, entry.version);
      } catch {
        failed = true;
      }
    }),
  );

  if (failed) return "error";
  return buffer.snapshot().length === 0 ? "saved" : "pending";
}
