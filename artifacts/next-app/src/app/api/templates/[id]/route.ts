import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, templatesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(templatesTable)
      .where(and(eq(templatesTable.id, id), eq(templatesTable.userId, user.id), eq(templatesTable.isPreset, false)));

    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(templatesTable).where(eq(templatesTable.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
