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
        masterPath: attachmentsTable.masterPath,
        proxyPath: attachmentsTable.proxyPath,
        masterFormat: attachmentsTable.masterFormat,
        createdAt: attachmentsTable.createdAt,
        noteTitle: notesTable.title,
      })
      .from(attachmentsTable)
      .innerJoin(notesTable, eq(attachmentsTable.noteId, notesTable.id))
      .where(
        and(
          eq(attachmentsTable.userId, user.id),
          isNull(attachmentsTable.deletedAt),
          isNull(notesTable.deletedAt),
          // For images: only show if the proxy (v2) or storage (v1) path is
          // embedded in the note content. Non-image files are always shown.
          or(
            sql`${attachmentsTable.fileType} NOT LIKE 'image/%'`,
            sql`${notesTable.content} LIKE '%' || COALESCE(${attachmentsTable.proxyPath}, ${attachmentsTable.storagePath}) || '%'`
          )
        )
      )
      .orderBy(desc(attachmentsTable.createdAt));

    const withUrls = await Promise.all(
      rows.map(async (row) => {
        // v2: proxy for display; v1: storagePath
        const displayPath = row.proxyPath ?? row.storagePath;
        const { data } = displayPath
          ? await supabaseAdmin.storage.from("note-attachments").createSignedUrl(displayPath, 604800)
          : { data: null };
        return { ...row, url: data?.signedUrl ?? null };
      })
    );

    return NextResponse.json(withUrls);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
