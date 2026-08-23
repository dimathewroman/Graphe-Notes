import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  attachmentUploadReservationsTable,
  attachmentsTable,
  db,
} from "@workspace/db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

export const UPLOAD_RESERVATION_LEASE_MS = 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 50;
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000;
const STORAGE_BUCKET = "note-attachments";

export type AttachmentDraft = typeof attachmentsTable.$inferInsert;
export type UploadReservation = { id: string; leaseToken: string };

export type ClaimedUploadReservation = UploadReservation & {
  storagePath: string | null;
  masterPath: string | null;
  proxyPath: string | null;
  retryCount: number;
};

export class UploadReservationError extends Error {
  constructor(readonly code: "reservation_unavailable" | "note_unavailable") {
    super(code);
  }
}

export async function createUploadReservation(
  draft: AttachmentDraft,
): Promise<UploadReservation> {
  const reservation = {
    id: randomUUID(),
    leaseToken: randomUUID(),
    leaseExpiresAt: new Date(Date.now() + UPLOAD_RESERVATION_LEASE_MS),
  };
  await db.insert(attachmentUploadReservationsTable).values({
    ...reservation,
    userId: draft.userId,
    noteId: draft.noteId,
    storagePath: draft.storagePath ?? null,
    masterPath: draft.masterPath ?? null,
    proxyPath: draft.proxyPath ?? null,
    attachment: draft,
  });
  return reservation;
}

/** Atomically fences the lease, rechecks the parent, inserts, and consumes the reservation. */
export async function finalizeUploadReservation(
  reservation: UploadReservation,
  draft: AttachmentDraft,
): Promise<typeof attachmentsTable.$inferSelect> {
  return db.transaction(async (tx) => {
    const lock = await tx.execute(
      sql`select id from private.attachment_upload_reservations
          where id = ${reservation.id}
            and lease_token = ${reservation.leaseToken}
            and state = 'uploading'
            and lease_expires_at > now()
          for update`,
    );
    if (lock.rows.length !== 1) {
      throw new UploadReservationError("reservation_unavailable");
    }

    // Serialize finalization against soft/hard deletion. If deletion commits
    // first this returns no row; if finalization locks first, its attachment
    // commit defines the serial order and the existing RESTRICT FK protects it.
    const noteLock = await tx.execute(
      sql`select id from public.notes
          where id = ${draft.noteId}
            and user_id = ${draft.userId}
            and deleted_at is null
            and auto_delete_at is null
          for update`,
    );
    if (noteLock.rows.length !== 1) {
      throw new UploadReservationError("note_unavailable");
    }

    const [attachment] = await tx
      .insert(attachmentsTable)
      .values(draft)
      .returning();
    if (!attachment) throw new Error("attachment insert returned no row");

    const consumed = await tx
      .delete(attachmentUploadReservationsTable)
      .where(
        and(
          eq(attachmentUploadReservationsTable.id, reservation.id),
          eq(
            attachmentUploadReservationsTable.leaseToken,
            reservation.leaseToken,
          ),
        ),
      )
      .returning({ id: attachmentUploadReservationsTable.id });
    if (consumed.length !== 1) {
      throw new UploadReservationError("reservation_unavailable");
    }
    return attachment;
  });
}

function boundedErrorCode(code: string): string {
  return code.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64) || "cleanup_failed";
}

export async function markReservationForCleanup(
  reservation: UploadReservation,
  code: string,
): Promise<boolean> {
  const now = new Date();
  const rows = await db
    .update(attachmentUploadReservationsTable)
    .set({
      state: "cleanup_pending",
      // Keep the current route's token exclusive while it performs the
      // immediate cleanup. A crash is recovered after this lease expires.
      leaseExpiresAt: new Date(now.getTime() + UPLOAD_RESERVATION_LEASE_MS),
      nextAttemptAt: now,
      lastErrorCode: boundedErrorCode(code),
      updatedAt: now,
    })
    .where(
      and(
        eq(attachmentUploadReservationsTable.id, reservation.id),
        eq(
          attachmentUploadReservationsTable.leaseToken,
          reservation.leaseToken,
        ),
      ),
    )
    .returning({ id: attachmentUploadReservationsTable.id });
  return rows.length === 1;
}

function uniquePaths(
  row: Pick<
    ClaimedUploadReservation,
    "storagePath" | "masterPath" | "proxyPath"
  >,
) {
  return [
    ...new Set(
      [row.storagePath, row.masterPath, row.proxyPath].filter(
        (path): path is string => Boolean(path),
      ),
    ),
  ];
}

async function retryClaim(
  row: ClaimedUploadReservation,
  code: string,
): Promise<void> {
  const retryCount = row.retryCount + 1;
  const delay = Math.min(
    2 ** Math.min(retryCount, 14) * 60_000,
    MAX_BACKOFF_MS,
  );
  const now = new Date();
  await db
    .update(attachmentUploadReservationsTable)
    .set({
      state: "cleanup_pending",
      retryCount,
      nextAttemptAt: new Date(now.getTime() + delay),
      leaseExpiresAt: now,
      lastErrorCode: boundedErrorCode(code),
      updatedAt: now,
    })
    .where(
      and(
        eq(attachmentUploadReservationsTable.id, row.id),
        eq(attachmentUploadReservationsTable.leaseToken, row.leaseToken),
      ),
    );
}

/** Deletes only paths that are not referenced by any completed attachment. */
export async function cleanupClaimedUploadReservation(
  row: ClaimedUploadReservation,
): Promise<boolean> {
  const paths = uniquePaths(row);
  try {
    const referenced = paths.length
      ? await db
          .select({
            storagePath: attachmentsTable.storagePath,
            masterPath: attachmentsTable.masterPath,
            proxyPath: attachmentsTable.proxyPath,
          })
          .from(attachmentsTable)
          .where(
            or(
              inArray(attachmentsTable.storagePath, paths),
              inArray(attachmentsTable.masterPath, paths),
              inArray(attachmentsTable.proxyPath, paths),
            ),
          )
      : [];
    const protectedPaths = new Set(referenced.flatMap(uniquePaths));
    const removable = paths.filter((path) => !protectedPaths.has(path));

    if (removable.length > 0) {
      const { error } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .remove(removable);
      if (error) {
        await retryClaim(row, "storage_remove_failed");
        return false;
      }
    }

    const deleted = await db
      .delete(attachmentUploadReservationsTable)
      .where(
        and(
          eq(attachmentUploadReservationsTable.id, row.id),
          eq(attachmentUploadReservationsTable.leaseToken, row.leaseToken),
        ),
      )
      .returning({ id: attachmentUploadReservationsTable.id });
    return deleted.length === 1;
  } catch {
    await retryClaim(row, "cleanup_exception");
    return false;
  }
}

/** Claim stale uploads and due cleanup rows exactly once across concurrent cron invocations. */
export async function claimExpiredUploadReservations(
  limit = CLEANUP_BATCH_SIZE,
): Promise<ClaimedUploadReservation[]> {
  const leaseToken = randomUUID();
  const result = await db.execute(sql`
    with due as (
      select id
      from private.attachment_upload_reservations
      where lease_expires_at <= now()
        and next_attempt_at <= now()
      order by next_attempt_at, created_at
      for update skip locked
      limit ${limit}
    )
    update private.attachment_upload_reservations r
       set state = 'cleanup_pending',
           lease_token = ${leaseToken},
           lease_expires_at = now() + interval '1 hour',
           updated_at = now()
      from due
     where r.id = due.id
    returning r.id, r.lease_token as "leaseToken", r.storage_path as "storagePath",
              r.master_path as "masterPath", r.proxy_path as "proxyPath",
              r.retry_count as "retryCount"
  `);
  return result.rows as ClaimedUploadReservation[];
}

export async function cleanupExpiredUploadReservations(): Promise<{
  claimed: number;
  cleaned: number;
  failed: number;
}> {
  const rows = await claimExpiredUploadReservations();
  let cleaned = 0;
  for (const row of rows) {
    if (await cleanupClaimedUploadReservation(row)) cleaned += 1;
  }
  return { claimed: rows.length, cleaned, failed: rows.length - cleaned };
}

/** Makes failed route compensation durable before attempting an immediate cleanup. */
export async function cleanupFailedUpload(
  reservation: UploadReservation,
  draft: AttachmentDraft,
  code: string,
): Promise<boolean> {
  if (!(await markReservationForCleanup(reservation, code))) return false;
  return cleanupClaimedUploadReservation({
    ...reservation,
    storagePath: draft.storagePath ?? null,
    masterPath: draft.masterPath ?? null,
    proxyPath: draft.proxyPath ?? null,
    retryCount: 0,
  });
}
