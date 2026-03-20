import { type NextRequest, NextResponse } from "next/server";
import { eq, ilike, and, or, sql, desc, asc } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  CreateNoteBody,
  GetNotesQueryParams,
  GetNotesResponse,
  GetNoteResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = GetNotesQueryParams.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) {
    return NextResponse.json({ error: query.error.message }, { status: 400 });
  }

  const { folderId, search, pinned, favorite, tag, sortBy, sortDir } = query.data;

  const conditions = [eq(notesTable.userId, user.id)];

  if (folderId !== undefined && folderId !== null) {
    conditions.push(eq(notesTable.folderId, folderId));
  }
  if (pinned !== undefined && pinned !== null) {
    conditions.push(eq(notesTable.pinned, pinned));
  }
  if (favorite !== undefined && favorite !== null) {
    conditions.push(eq(notesTable.favorite, favorite));
  }
  if (search) {
    conditions.push(
      or(ilike(notesTable.title, `%${search}%`), ilike(notesTable.contentText, `%${search}%`))!,
    );
  }
  if (tag) {
    conditions.push(sql`${notesTable.tags} @> ARRAY[${tag}]::text[]`);
  }

  const orderCol =
    sortBy === "title"
      ? notesTable.title
      : sortBy === "createdAt"
        ? notesTable.createdAt
        : notesTable.updatedAt;
  const orderDir = sortDir === "asc" ? asc(orderCol) : desc(orderCol);

  const notes = await db
    .select()
    .from(notesTable)
    .where(and(...conditions))
    .orderBy(orderDir);

  return NextResponse.json(GetNotesResponse.parse(notes));
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateNoteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [note] = await db
    .insert(notesTable)
    .values({ ...parsed.data, userId: user.id })
    .returning();

  return NextResponse.json(GetNoteResponse.parse(note), { status: 201 });
}
