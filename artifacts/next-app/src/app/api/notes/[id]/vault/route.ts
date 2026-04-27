import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  ToggleNoteVaultParams,
  ToggleNoteVaultBody,
  ToggleNoteVaultResponse,
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
    const routeParams = ToggleNoteVaultParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json({ error: routeParams.error.message }, { status: 400 });
    }

    const body = await request.json();
    const parsed = ToggleNoteVaultBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const [note] = await db
      .update(notesTable)
      .set({ vaulted: parsed.data.vaulted })
      .where(and(eq(notesTable.id, routeParams.data.id), eq(notesTable.userId, user.id)))
      .returning();

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json(ToggleNoteVaultResponse.parse(note));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
