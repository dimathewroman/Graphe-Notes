import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable } from "@workspace/db";
import {
  ToggleNoteVaultParams,
  ToggleNoteVaultBody,
  ToggleNoteVaultResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { hasValidVaultProof } from "@/lib/vault-proof";
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

    // Unvaulting exposes the note's content — require the vault to be unlocked
    // (a valid proof), so a locked client can't strip protection off a note
    // (§S / X-S2). Vaulting (adding protection) needs no proof.
    if (parsed.data.vaulted === false) {
      const unlocked = await hasValidVaultProof(request.headers.get("x-vault-proof"), user.id);
      if (!unlocked) {
        return NextResponse.json(
          { error: "Unlock the vault to remove a note from it" },
          { status: 403 },
        );
      }
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
