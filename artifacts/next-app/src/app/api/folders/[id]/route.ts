import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, foldersTable } from "@workspace/db";
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

    return new Response(null, { status: 204 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
