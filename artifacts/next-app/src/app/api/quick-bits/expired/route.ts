import { type NextRequest, NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db, quickBitsTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";

export async function DELETE(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await db
    .delete(quickBitsTable)
    .where(and(eq(quickBitsTable.userId, user.id), lte(quickBitsTable.expiresAt, new Date())))
    .returning({ id: quickBitsTable.id });

  return NextResponse.json({ count: deleted.length });
}
