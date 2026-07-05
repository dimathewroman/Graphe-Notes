import { inArray } from "drizzle-orm";
import { db, attachmentsTable, noteVersionsTable } from "@workspace/db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

const STORAGE_BUCKET = "note-attachments";
const STORAGE_REMOVE_BATCH = 100;

/**
 * Hard-remove every child of the given notes — attachment rows + their storage
 * objects, and version snapshots — so nothing is orphaned when the note rows are
 * deleted (X-R1 / X-R2). MUST run BEFORE deleting the note rows: the
 * attachments.note_id and note_versions.note_id foreign keys are ON DELETE
 * RESTRICT, so deleting a note that still has children will throw.
 *
 * Returns the number of storage-remove batches that errored (non-fatal — the DB
 * rows are still removed; a storage error just leaves a file behind, which the
 * next run can retry).
 */
export async function purgeNoteChildren(
  noteIds: number[],
): Promise<{ storageErrors: number }> {
  if (noteIds.length === 0) return { storageErrors: 0 };

  // 1. Attachments — delete the rows and collect their storage paths.
  //    v1 rows carry storagePath; v2 rows carry masterPath + proxyPath.
  const removed = await db
    .delete(attachmentsTable)
    .where(inArray(attachmentsTable.noteId, noteIds))
    .returning({
      storagePath: attachmentsTable.storagePath,
      masterPath: attachmentsTable.masterPath,
      proxyPath: attachmentsTable.proxyPath,
    });

  const pathSet = new Set<string>();
  for (const a of removed) {
    for (const p of [a.storagePath, a.masterPath, a.proxyPath]) {
      if (p) pathSet.add(p);
    }
  }
  const paths = Array.from(pathSet);

  let storageErrors = 0;
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH);
    const { error } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(batch);
    if (error) {
      Sentry.captureException(
        new Error(`[purgeNoteChildren] Storage remove error: ${error.message}`),
      );
      storageErrors++;
    }
  }

  // 2. Version snapshots.
  await db.delete(noteVersionsTable).where(inArray(noteVersionsTable.noteId, noteIds));

  return { storageErrors };
}
