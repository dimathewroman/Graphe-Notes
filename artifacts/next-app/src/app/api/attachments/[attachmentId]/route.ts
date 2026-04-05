import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, attachmentsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attachmentId } = await params;
  if (!attachmentId) return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 });

  // Find the attachment and verify ownership
  const [attachment] = await db
    .select()
    .from(attachmentsTable)
    .where(and(eq(attachmentsTable.id, attachmentId), eq(attachmentsTable.userId, user.id)))
    .limit(1);

  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  // Delete from Supabase Storage
  const { error: storageError } = await supabaseAdmin.storage
    .from("note-attachments")
    .remove([attachment.storagePath]);

  if (storageError) {
    console.error("[attachments] Storage delete error:", storageError.message);
    // Proceed with DB deletion even if storage fails — avoid orphaned records
  }

  // Delete DB record
  await db
    .delete(attachmentsTable)
    .where(and(eq(attachmentsTable.id, attachmentId), eq(attachmentsTable.userId, user.id)));

  return new NextResponse(null, { status: 204 });
}
