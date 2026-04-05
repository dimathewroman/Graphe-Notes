import { type NextRequest, NextResponse } from "next/server";
import { and, isNotNull, lte } from "drizzle-orm";
import { db, notesTable, attachmentsTable } from "@workspace/db";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ATTACHMENT_RETENTION_DAYS = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 1. Hard-delete recently-deleted notes past their auto-delete date
  const purgedNotes = await db
    .delete(notesTable)
    .where(and(isNotNull(notesTable.autoDeleteAt), lte(notesTable.autoDeleteAt, now)))
    .returning({ id: notesTable.id });

  // 2. Hard-purge soft-deleted attachments older than 30 days
  const cutoff = new Date(now.getTime() - ATTACHMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expiredAttachments = await db
    .delete(attachmentsTable)
    .where(and(isNotNull(attachmentsTable.deletedAt), lte(attachmentsTable.deletedAt, cutoff)))
    .returning({ id: attachmentsTable.id, storagePath: attachmentsTable.storagePath });

  // Remove the actual files from Supabase Storage in batches of 100
  let storageErrors = 0;
  const paths = expiredAttachments.map(a => a.storagePath);
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await supabaseAdmin.storage.from("note-attachments").remove(batch);
    if (error) {
      console.error("[purge-deleted] Storage remove error:", error.message);
      storageErrors++;
    }
  }

  return NextResponse.json({
    purgedNotes: purgedNotes.length,
    purgedAttachments: expiredAttachments.length,
    storageErrors,
  });
}
