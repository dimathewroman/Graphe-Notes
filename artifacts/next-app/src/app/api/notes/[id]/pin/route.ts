import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { ToggleNotePinParams, ToggleNotePinResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const routeParams = ToggleNotePinParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)));

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const [note] = await db
      .update(notesTable)
      .set({ pinned: !existing.pinned })
      .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
      .returning();

    return NextResponse.json(ToggleNotePinResponse.parse(note));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
