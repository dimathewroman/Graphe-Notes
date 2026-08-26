export interface PendingNoteSave {
  id: number;
  data: Record<string, unknown>;
}

export interface PendingNoteSaveSnapshot extends PendingNoteSave {
  version: number;
}

/**
 * A note-local retry buffer. Payloads are merged only with edits for the same
 * note, so an in-flight save that fails after a note switch cannot absorb the
 * newly selected note's changes.
 */
export class PerNoteSaveBuffer {
  private readonly pending = new Map<number, Record<string, unknown>>();
  private readonly versions = new Map<number, number>();

  private advanceVersion(id: number): void {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
  }

  queue(id: number, data: Record<string, unknown>): Record<string, unknown> {
    const next = { ...(this.pending.get(id) ?? {}), ...data };
    this.pending.set(id, next);
    this.advanceVersion(id);
    return next;
  }

  retry(id: number, data: Record<string, unknown>): Record<string, unknown> {
    const next = { ...data, ...(this.pending.get(id) ?? {}) };
    this.pending.set(id, next);
    this.advanceVersion(id);
    return next;
  }

  take(id: number): Record<string, unknown> | null {
    const data = this.pending.get(id);
    if (!data) return null;
    this.pending.delete(id);
    this.versions.delete(id);
    return data;
  }

  snapshot(): PendingNoteSaveSnapshot[] {
    return [...this.pending].map(([id, data]) => ({
      id,
      data,
      version: this.versions.get(id) ?? 0,
    }));
  }

  acknowledge(id: number, version: number): boolean {
    if (this.versions.get(id) !== version) return false;
    this.pending.delete(id);
    this.versions.delete(id);
    return true;
  }

  drain(): PendingNoteSave[] {
    const entries = [...this.pending].map(([id, data]) => ({ id, data }));
    this.pending.clear();
    this.versions.clear();
    return entries;
  }

  has(id: number): boolean {
    return this.pending.has(id);
  }
}
