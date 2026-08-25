export interface PendingNoteSave {
  id: number;
  data: Record<string, unknown>;
}

/**
 * A note-local retry buffer. Payloads are merged only with edits for the same
 * note, so an in-flight save that fails after a note switch cannot absorb the
 * newly selected note's changes.
 */
export class PerNoteSaveBuffer {
  private readonly pending = new Map<number, Record<string, unknown>>();

  queue(id: number, data: Record<string, unknown>): Record<string, unknown> {
    const next = { ...(this.pending.get(id) ?? {}), ...data };
    this.pending.set(id, next);
    return next;
  }

  retry(id: number, data: Record<string, unknown>): Record<string, unknown> {
    return this.queue(id, data);
  }

  take(id: number): Record<string, unknown> | null {
    const data = this.pending.get(id);
    if (!data) return null;
    this.pending.delete(id);
    return data;
  }

  drain(): PendingNoteSave[] {
    const entries = [...this.pending].map(([id, data]) => ({ id, data }));
    this.pending.clear();
    return entries;
  }

  has(id: number): boolean {
    return this.pending.has(id);
  }
}
