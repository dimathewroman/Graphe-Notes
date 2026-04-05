import { type NextRequest, NextResponse } from "next/server";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db, attachmentsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .leftJoin(notesTable, eq(attachmentsTable.noteId, notesTable.id))
    .where(and(eq(attachmentsTable.userId, user.id), isNull(attachmentsTable.deletedAt)))
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
}
