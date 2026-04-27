import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, quickBitsTable, notesTable } from "@workspace/db";
import { getAuthUser } from "@/lib/auth-server";
import * as Sentry from "@sentry/nextjs";

const RouteParams = z.object({ id: z.coerce.number().int().positive() });

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const routeParams = RouteParams.safeParse(await params);
    if (!routeParams.success) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const [qb] = await db
      .select()
      .from(quickBitsTable)
      .where(and(eq(quickBitsTable.id, routeParams.data.id), eq(quickBitsTable.userId, user.id)));

    if (!qb) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + 30 * 86_400_000);

    const [note] = await db
      .insert(notesTable)
      .values({
        userId: qb.userId,
        title: qb.title,
        content: qb.content,
        contentText: qb.contentText,
        deletedAt: now,
        autoDeleteAt,
        deletedReason: "deleted" as const,
        tags: [] as string[],
        pinned: false,
        favorite: false,
        vaulted: false,
        folderId: null,
        coverImage: null,
      })
      .returning({ noteId: notesTable.id });

    await db
      .delete(quickBitsTable)
      .where(and(eq(quickBitsTable.id, routeParams.data.id), eq(quickBitsTable.userId, user.id)));

    return NextResponse.json({ noteId: note.noteId });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
