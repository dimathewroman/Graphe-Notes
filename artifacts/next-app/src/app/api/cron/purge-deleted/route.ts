import { type NextRequest, NextResponse } from "next/server";
import { and, isNotNull, lte } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const purged = await db
    .delete(notesTable)
    .where(and(isNotNull(notesTable.autoDeleteAt), lte(notesTable.autoDeleteAt, now)))
    .returning({ id: notesTable.id });

  return NextResponse.json({ purged: purged.length });
}
