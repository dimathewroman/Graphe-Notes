import { type NextRequest, NextResponse } from "next/server";
import { db, smartFoldersTable } from "@workspace/db";
import {
  GetSmartFoldersResponse,
  CreateSmartFolderBody,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET() {
  const folders = await db
    .select()
    .from(smartFoldersTable)
    .orderBy(smartFoldersTable.sortOrder);
  return NextResponse.json(GetSmartFoldersResponse.parse(folders));
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateSmartFolderBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [folder] = await db
    .insert(smartFoldersTable)
    .values({ ...parsed.data, tagRules: parsed.data.tagRules ?? [] })
    .returning();

  return NextResponse.json(folder, { status: 201 });
}
