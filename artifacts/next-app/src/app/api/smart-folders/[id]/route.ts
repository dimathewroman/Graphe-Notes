import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, smartFoldersTable } from "@workspace/db";
import {
  UpdateSmartFolderBody,
  UpdateSmartFolderParams,
  DeleteSmartFolderParams,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = UpdateSmartFolderParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = UpdateSmartFolderBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [folder] = await db
    .update(smartFoldersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(
      and(
        eq(smartFoldersTable.id, routeParams.data.id),
        eq(smartFoldersTable.userId, user.id),
      ),
    )
    .returning();

  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(folder);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = DeleteSmartFolderParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [folder] = await db
    .delete(smartFoldersTable)
    .where(
      and(
        eq(smartFoldersTable.id, routeParams.data.id),
        eq(smartFoldersTable.userId, user.id),
      ),
    )
    .returning();

  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
