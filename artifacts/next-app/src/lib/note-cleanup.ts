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
 * Storage is removed before database rows. If storage removal fails, rows stay
 * intact so their paths remain available for a later retry. Callers must not
 * delete the parent note unless `complete` is true.
 */
export async function purgeNoteChildren(
  noteIds: number[],
): Promise<{ complete: boolean; storageErrors: number }> {
  if (noteIds.length === 0) return { complete: true, storageErrors: 0 };

  // 1. Read paths while their attachment rows still provide a durable retry
  // inventory. v1 rows carry storagePath; v2 rows carry masterPath + proxyPath.
  const attachments = await db
    .select({
      id: attachmentsTable.id,
      storagePath: attachmentsTable.storagePath,
      masterPath: attachmentsTable.masterPath,
      proxyPath: attachmentsTable.proxyPath,
    })
    .from(attachmentsTable)
    .where(inArray(attachmentsTable.noteId, noteIds));
  const versions = await db
    .select({ id: noteVersionsTable.id })
    .from(noteVersionsTable)
    .where(inArray(noteVersionsTable.noteId, noteIds));

  const pathSet = new Set<string>();
  for (const a of attachments) {
    for (const p of [a.storagePath, a.masterPath, a.proxyPath]) {
      if (p) pathSet.add(p);
    }
  }
  const paths = Array.from(pathSet);

  let storageErrors = 0;
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH) {
    const batch = paths.slice(i, i + STORAGE_REMOVE_BATCH);
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove(batch);
    if (error) {
      Sentry.captureException(
        new Error(`[purgeNoteChildren] Storage remove error: ${error.message}`),
      );
      storageErrors++;
    }
  }

  if (storageErrors > 0) {
    return { complete: false, storageErrors };
  }

  // 2. Only after all storage removals succeed can the snapshotted child rows be
  // removed. Never delete by noteId here: an upload that starts during cleanup
  // must retain its row as retry inventory.
  if (attachments.length > 0) {
    await db.delete(attachmentsTable).where(
      inArray(
        attachmentsTable.id,
        attachments.map((attachment) => attachment.id),
      ),
    );
  }
  if (versions.length > 0) {
    await db.delete(noteVersionsTable).where(
      inArray(
        noteVersionsTable.id,
        versions.map((version) => version.id),
      ),
    );
  }

  // 3. A child inserted after the snapshot is a concurrent write. Leave it in
  // place and make the parent deletion retry; FK RESTRICT backs this up if a
  // child appears after these checks.
  const [remainingAttachments, remainingVersions] = await Promise.all([
    db
      .select({ id: attachmentsTable.id })
      .from(attachmentsTable)
      .where(inArray(attachmentsTable.noteId, noteIds))
      .limit(1),
    db
      .select({ id: noteVersionsTable.id })
      .from(noteVersionsTable)
      .where(inArray(noteVersionsTable.noteId, noteIds))
      .limit(1),
  ]);
  if (remainingAttachments.length > 0 || remainingVersions.length > 0) {
    return { complete: false, storageErrors: 0 };
  }

  return { complete: true, storageErrors };
}
