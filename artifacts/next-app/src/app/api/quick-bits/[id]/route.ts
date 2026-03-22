import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, quickBitsTable } from "@workspace/db";
import {
  GetQuickBitParams,
  GetQuickBitResponse,
  UpdateQuickBitParams,
  UpdateQuickBitBody,
  UpdateQuickBitResponse,
  DeleteQuickBitParams,
  DeleteQuickBitResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = GetQuickBitParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
  }

  const [quickBit] = await db
    .select()
    .from(quickBitsTable)
    .where(and(eq(quickBitsTable.id, routeParams.data.id), eq(quickBitsTable.userId, user.id)));

  if (!quickBit) {
    return NextResponse.json({ error: "Quick Bit not found" }, { status: 404 });
  }

  return NextResponse.json(GetQuickBitResponse.parse(quickBit));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = UpdateQuickBitParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
  }

  const body = await request.json();
  const parsed = UpdateQuickBitBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // Convert expiresAt string to Date and validate it's in the future
  let expiresAt: Date | undefined;
  if (parsed.data.expiresAt !== undefined) {
    expiresAt = new Date(parsed.data.expiresAt);
    if (expiresAt <= new Date()) {
      return NextResponse.json({ error: "expiresAt must be in the future" }, { status: 400 });
    }
  }

  const { expiresAt: _expiresAtStr, ...rest } = parsed.data;
  const updateData = expiresAt !== undefined ? { ...rest, expiresAt } : rest;

  const isContentChange =
    rest.title !== undefined ||
    rest.content !== undefined ||
    rest.contentText !== undefined;

  const updatePayload = isContentChange
    ? { ...updateData, updatedAt: new Date() }
    : { ...updateData };

  const [quickBit] = await db
    .update(quickBitsTable)
    .set(updatePayload)
    .where(and(eq(quickBitsTable.id, routeParams.data.id), eq(quickBitsTable.userId, user.id)))
    .returning();

  if (!quickBit) {
    return NextResponse.json({ error: "Quick Bit not found" }, { status: 404 });
  }

  return NextResponse.json(UpdateQuickBitResponse.parse(quickBit));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const routeParams = DeleteQuickBitParams.safeParse({ id });
  if (!routeParams.success) {
    return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
  }

  const [deleted] = await db
    .delete(quickBitsTable)
    .where(and(eq(quickBitsTable.id, routeParams.data.id), eq(quickBitsTable.userId, user.id)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Quick Bit not found" }, { status: 404 });
  }

  return NextResponse.json(DeleteQuickBitResponse.parse(deleted));
}
