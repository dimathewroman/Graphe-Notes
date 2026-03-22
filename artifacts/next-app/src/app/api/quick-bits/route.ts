import { type NextRequest, NextResponse } from "next/server";
import { eq, ilike, and, or, desc, asc } from "drizzle-orm";
import { db, quickBitsTable, quickBitSettingsTable } from "@workspace/db";
import {
  CreateQuickBitBody,
  GetQuickBitsQueryParams,
  GetQuickBitsResponse,
  GetQuickBitResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = GetQuickBitsQueryParams.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!query.success) {
    return NextResponse.json({ error: query.error.message }, { status: 400 });
  }

  const { search, sortBy, sortDir } = query.data;

  const conditions = [eq(quickBitsTable.userId, user.id)];

  if (search) {
    conditions.push(
      or(ilike(quickBitsTable.title, `%${search}%`), ilike(quickBitsTable.contentText, `%${search}%`))!,
    );
  }

  const orderCol =
    sortBy === "title"
      ? quickBitsTable.title
      : sortBy === "createdAt"
        ? quickBitsTable.createdAt
        : sortBy === "expiresAt"
          ? quickBitsTable.expiresAt
          : quickBitsTable.updatedAt;
  const orderDir = sortDir === "asc" ? asc(orderCol) : desc(orderCol);

  const quickBits = await db
    .select()
    .from(quickBitsTable)
    .where(and(...conditions))
    .orderBy(orderDir);

  return NextResponse.json(GetQuickBitsResponse.parse(quickBits));
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateQuickBitBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Read user's default expiration setting (default to 3 days if not set)
  const [settings] = await db
    .select()
    .from(quickBitSettingsTable)
    .where(eq(quickBitSettingsTable.userId, user.id))
    .limit(1);

  const expirationDays = settings?.defaultExpirationDays ?? 3;
  const notificationHours = settings?.defaultNotificationHours ?? [24];
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  const [quickBit] = await db
    .insert(quickBitsTable)
    .values({ ...parsed.data, userId: user.id, expiresAt, notificationHours })
    .returning();

  return NextResponse.json(GetQuickBitResponse.parse(quickBit), { status: 201 });
}
