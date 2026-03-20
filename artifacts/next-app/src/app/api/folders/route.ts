import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, foldersTable } from "@workspace/db";
import {
  CreateFolderBody,
  GetFoldersResponse,
  UpdateFolderResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folders = await db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.userId, user.id))
    .orderBy(foldersTable.sortOrder, foldersTable.name);

  return NextResponse.json(GetFoldersResponse.parse(folders));
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateFolderBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [folder] = await db
    .insert(foldersTable)
    .values({ ...parsed.data, userId: user.id })
    .returning();

  return NextResponse.json(UpdateFolderResponse.parse(folder), { status: 201 });
}
