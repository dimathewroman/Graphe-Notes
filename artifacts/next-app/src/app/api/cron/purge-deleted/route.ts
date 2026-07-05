import { type NextRequest, NextResponse } from "next/server";
import { and, isNotNull, lte, inArray } from "drizzle-orm";
import { db, notesTable, attachmentsTable } from "@workspace/db";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { purgeNoteChildren } from "@/lib/note-cleanup";
import { verifyCronAuth } from "@/lib/cron-auth";
import * as Sentry from "@sentry/nextjs";

const ATTACHMENT_RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(request.headers.get("Authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const now = new Date();

    // 1. Hard-delete recently-deleted notes past their auto-delete date.
    //    X-R1/X-R2: purge each note's attachments (rows + storage) and version
    //    snapshots FIRST — the child FKs are ON DELETE RESTRICT, so deleting a
    //    note that still has children would throw.
    const notesToPurge = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(and(isNotNull(notesTable.autoDeleteAt), lte(notesTable.autoDeleteAt, now)));
    const purgeIds = notesToPurge.map((n) => n.id);

    const childCleanup = await purgeNoteChildren(purgeIds);

    const purgedNotes =
      purgeIds.length > 0
        ? await db
            .delete(notesTable)
            .where(inArray(notesTable.id, purgeIds))
            .returning({ id: notesTable.id })
        : [];

    // 2. Hard-purge soft-deleted attachments older than 30 days
    const cutoff = new Date(now.getTime() - ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const expiredAttachments = await db
      .delete(attachmentsTable)
      .where(and(isNotNull(attachmentsTable.deletedAt), lte(attachmentsTable.deletedAt, cutoff)))
      .returning({
        id: attachmentsTable.id,
        storagePath: attachmentsTable.storagePath,
        masterPath: attachmentsTable.masterPath,
        proxyPath: attachmentsTable.proxyPath,
      });

    // Collect all unique storage paths for each attachment:
    // v1 rows have storagePath; v2 rows have masterPath + proxyPath.
    // For animated GIF fallback, proxyPath === masterPath — use a Set to deduplicate.
    const pathSet = new Set<string>();
    for (const a of expiredAttachments) {
      const candidates = [a.storagePath, a.masterPath, a.proxyPath];
      for (const p of candidates) {
        if (p) pathSet.add(p);
      }
    }
    const paths = Array.from(pathSet);

    // Remove the actual files from Supabase Storage in batches of 100
    let storageErrors = childCleanup.storageErrors;
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await supabaseAdmin.storage.from("note-attachments").remove(batch);
      if (error) {
        Sentry.captureException(new Error(`[purge-deleted] Storage remove error: ${error.message}`));
        storageErrors++;
      }
    }

    return NextResponse.json({
      purgedNotes: purgedNotes.length,
      purgedAttachments: expiredAttachments.length,
      storageErrors,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
