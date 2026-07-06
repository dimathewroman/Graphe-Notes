import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, foldersTable, notesTable } from "@workspace/db";
import {
  UpdateFolderBody,
  UpdateFolderParams,
  DeleteFolderParams,
  UpdateFolderResponse,
} from "@workspace/api-zod";
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
    const routeParams = UpdateFolderParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateFolderBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const [folder] = await db
      .update(foldersTable)
      .set(parsed.data)
      .where(and(eq(foldersTable.id, routeParams.data.id), eq(foldersTable.userId, user.id)))
      .returning();

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    return NextResponse.json(UpdateFolderResponse.parse(folder));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const routeParams = DeleteFolderParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
    }

    const [folder] = await db
      .delete(foldersTable)
      .where(and(eq(foldersTable.id, routeParams.data.id), eq(foldersTable.userId, user.id)))
      .returning();

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // X-R4: nothing may be left pointing at a folder that no longer exists.
    // Detach notes that were in this folder (they move to "no folder", not deleted),
    // and reparent any child folders to the deleted folder's own parent.
    await db
      .update(notesTable)
      .set({ folderId: null })
      .where(and(eq(notesTable.folderId, routeParams.data.id), eq(notesTable.userId, user.id)));
    await db
      .update(foldersTable)
      .set({ parentId: folder.parentId })
      .where(and(eq(foldersTable.parentId, routeParams.data.id), eq(foldersTable.userId, user.id)));

    return new Response(null, { status: 204 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
