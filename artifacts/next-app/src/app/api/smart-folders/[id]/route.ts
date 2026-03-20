import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, smartFoldersTable } from "@workspace/db";
import {
  UpdateSmartFolderBody,
  UpdateSmartFolderParams,
  DeleteSmartFolderParams,
} from "@workspace/api-zod";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    .where(eq(smartFoldersTable.id, routeParams.data.id))
    .returning();

  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(folder);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const routeParams = DeleteSmartFolderParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [folder] = await db
    .delete(smartFoldersTable)
    .where(eq(smartFoldersTable.id, routeParams.data.id))
    .returning();

  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
