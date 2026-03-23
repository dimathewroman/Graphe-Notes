import { type NextRequest, NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db, quickBitsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

export async function DELETE(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Find all expired QBs for this user
  const expired = await db
    .select()
    .from(quickBitsTable)
    .where(and(eq(quickBitsTable.userId, user.id), lte(quickBitsTable.expiresAt, new Date())));

  if (expired.length === 0) return NextResponse.json({ count: 0 });

  // 2. Convert each expired QB to a soft-deleted note so it lands in Recently Deleted
  const now = new Date();
  const autoDeleteAt = new Date(now.getTime() + 30 * 86_400_000);

  await db.insert(notesTable).values(
    expired.map((qb) => ({
      userId: qb.userId,
      title: qb.title,
      content: qb.content,
      contentText: qb.contentText,
      deletedAt: now,
      autoDeleteAt,
      deletedReason: "expired" as const,
      tags: [] as string[],
      pinned: false,
      favorite: false,
      vaulted: false,
      folderId: null,
      coverImage: null,
    })),
  );

  // 3. Hard-delete the QB rows — they now live as notes in Recently Deleted
  await db
    .delete(quickBitsTable)
    .where(and(eq(quickBitsTable.userId, user.id), lte(quickBitsTable.expiresAt, now)));

  return NextResponse.json({ count: expired.length });
}
