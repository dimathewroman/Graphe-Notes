import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import { ToggleNoteFavoriteParams, ToggleNoteFavoriteResponse } from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = ToggleNoteFavoriteParams.safeParse({ id });
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
    .set({ favorite: !existing.favorite })
    .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
    .returning();

  return NextResponse.json(ToggleNoteFavoriteResponse.parse(note));
}
