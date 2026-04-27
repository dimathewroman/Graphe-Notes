import { type NextRequest, NextResponse } from "next/server";
import { eq, desc, and, isNull, or, sql } from "drizzle-orm";
import { db, attachmentsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db
      .select({
        id: attachmentsTable.id,
        noteId: attachmentsTable.noteId,
        fileName: attachmentsTable.fileName,
        fileType: attachmentsTable.fileType,
        fileSize: attachmentsTable.fileSize,
        storagePath: attachmentsTable.storagePath,
        createdAt: attachmentsTable.createdAt,
        noteTitle: notesTable.title,
      })
      .from(attachmentsTable)
      .innerJoin(notesTable, eq(attachmentsTable.noteId, notesTable.id))
      .where(
        and(
          eq(attachmentsTable.userId, user.id),
          isNull(attachmentsTable.deletedAt),
          // Exclude attachments from soft-deleted notes
          isNull(notesTable.deletedAt),
          // For images: only show if the storage path is actually embedded in the note content.
          // This filters out orphaned uploads (deleted from editor, old test data, duplicates).
          // Non-image files (PDFs, etc.) are kept as long as the note is active.
          or(
            sql`${attachmentsTable.fileType} NOT LIKE 'image/%'`,
            sql`${notesTable.content} LIKE '%' || ${attachmentsTable.storagePath} || '%'`
          )
        )
      )
      .orderBy(desc(attachmentsTable.createdAt));

    const withUrls = await Promise.all(
      rows.map(async (row) => {
        const { data } = await supabaseAdmin.storage
          .from("note-attachments")
          .createSignedUrl(row.storagePath, 3600);
        return { ...row, url: data?.signedUrl ?? null };
      })
    );

    return NextResponse.json(withUrls);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
