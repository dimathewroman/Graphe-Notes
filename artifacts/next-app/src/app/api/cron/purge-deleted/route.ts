import { type NextRequest, NextResponse } from "next/server";
import { and, isNotNull, lte, inArray } from "drizzle-orm";
import { db, notesTable, attachmentsTable } from "@workspace/db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { purgeNoteChildren } from "@/lib/note-cleanup";
import { verifyCronAuth } from "@/lib/cron-auth";
import * as Sentry from "@sentry/nextjs";
import { cleanupExpiredUploadReservations } from "@/lib/attachment-upload-reservation";

const ATTACHMENT_RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request.headers.get("Authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const now = new Date();
  const failures: string[] = [];
  let purgedNotes = 0;
  let purgedAttachments = 0;
  let storageErrors = 0;
  let uploadReservations = { claimed: 0, cleaned: 0, failed: 0 };

  // Each phase is independent and runs once. A failure gates only that phase's
  // destructive row delete; it must not starve the durable reservation worker.
  try {
    const notesToPurge = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(
        and(
          isNotNull(notesTable.autoDeleteAt),
          lte(notesTable.autoDeleteAt, now),
        ),
      );
    const purgeIds = notesToPurge.map((note) => note.id);
    const childCleanup = await purgeNoteChildren(purgeIds);
    storageErrors += childCleanup.storageErrors;
    if (!childCleanup.complete) {
      failures.push("note_child_cleanup");
    } else if (purgeIds.length > 0) {
      purgedNotes = (
        await db
          .delete(notesTable)
          .where(inArray(notesTable.id, purgeIds))
          .returning({ id: notesTable.id })
      ).length;
    }
  } catch {
    failures.push("note_cleanup_exception");
  }

  try {
    const cutoff = new Date(
      now.getTime() - ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    const expired = await db
      .select({
        id: attachmentsTable.id,
        storagePath: attachmentsTable.storagePath,
        masterPath: attachmentsTable.masterPath,
        proxyPath: attachmentsTable.proxyPath,
      })
      .from(attachmentsTable)
      .where(
        and(
          isNotNull(attachmentsTable.deletedAt),
          lte(attachmentsTable.deletedAt, cutoff),
        ),
      );
    const paths = [
      ...new Set(
        expired.flatMap((attachment) =>
          [
            attachment.storagePath,
            attachment.masterPath,
            attachment.proxyPath,
          ].filter((path): path is string => Boolean(path)),
        ),
      ),
    ];
    let attachmentStorageErrors = 0;
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await supabaseAdmin.storage
        .from("note-attachments")
        .remove(paths.slice(index, index + 100));
      if (error) {
        attachmentStorageErrors += 1;
        storageErrors += 1;
      }
    }
    if (attachmentStorageErrors > 0) {
      failures.push("attachment_storage_cleanup");
    } else if (expired.length > 0) {
      await db
        .delete(attachmentsTable)
        .where(
          and(
            isNotNull(attachmentsTable.deletedAt),
            lte(attachmentsTable.deletedAt, cutoff),
          ),
        );
      purgedAttachments = expired.length;
    }
  } catch {
    failures.push("attachment_cleanup_exception");
  }

  try {
    uploadReservations = await cleanupExpiredUploadReservations();
    if (uploadReservations.failed > 0) {
      failures.push("upload_reservation_cleanup");
    }
  } catch {
    failures.push("upload_reservation_cleanup_exception");
  }

  if (failures.length > 0) {
    Sentry.captureException(new Error("[purge-deleted] cleanup_incomplete"), {
      fingerprint: ["purge-deleted", "cleanup-incomplete"],
      extra: {
        failureCount: failures.length,
        storageErrors,
        failedReservationCount: uploadReservations.failed,
      },
    });
    return NextResponse.json(
      {
        error: "Cleanup incomplete; retry later",
        failures,
        storageErrors,
        uploadReservations,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    purgedNotes,
    purgedAttachments,
    storageErrors,
    uploadReservations,
  });
}
