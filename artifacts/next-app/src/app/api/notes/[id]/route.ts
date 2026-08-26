import { type NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, notesTable, foldersTable } from "@workspace/db";
import {
  GetNoteParams,
  GetNoteResponse,
  UpdateNoteParams,
  UpdateNoteBody,
  UpdateNoteResponse,
} from "@workspace/api-zod";
import { getAuthUser } from "@/lib/auth-server";
import { hasValidVaultProof } from "@/lib/vault-proof";
import { canAccessVaultedNote } from "@/lib/vault-note-authorization";
import { orderedNoteSaveWhere } from "@/lib/note-save-ordering-sql";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const routeParams = GetNoteParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json(
        { error: routeParams.error.message },
        { status: 400 },
      );
    }

    const [note] = await db
      .select()
      .from(notesTable)
      .where(
        and(
          eq(notesTable.id, routeParams.data.id),
          eq(notesTable.userId, user.id),
        ),
      );

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // X-S2: don't return a vaulted note's content to a locked client. Keep the
    // metadata (incl. vaulted:true) so the client can render the lock screen,
    // but blank the content until a valid unlock proof is presented.
    if (note.vaulted) {
      const unlocked = await hasValidVaultProof(
        request.headers.get("x-vault-proof"),
        user.id,
      );
      if (!unlocked) {
        return NextResponse.json(
          GetNoteResponse.parse({ ...note, content: "", contentText: "" }),
        );
      }
    }

    return NextResponse.json(GetNoteResponse.parse(note));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const routeParams = UpdateNoteParams.safeParse({ id });
    if (!routeParams.success) {
      return NextResponse.json(
        { error: routeParams.error.message },
        { status: 400 },
      );
    }

    const body = await request.json();
    const parsed = UpdateNoteBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const [existingNote] = await db
      .select({ id: notesTable.id, vaulted: notesTable.vaulted })
      .from(notesTable)
      .where(
        and(
          eq(notesTable.id, routeParams.data.id),
          eq(notesTable.userId, user.id),
        ),
      )
      .limit(1);

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (!(await canAccessVaultedNote(request, user.id, existingNote.vaulted))) {
      return NextResponse.json(
        { error: "Vault unlock required" },
        { status: 403 },
      );
    }

    const {
      baseRevision,
      saveSessionId,
      saveSequence,
      ...notePatch
    } = parsed.data;
    const hasAnyOrderingField =
      baseRevision !== undefined ||
      saveSessionId !== undefined ||
      saveSequence !== undefined;
    const hasCompleteOrdering =
      baseRevision !== undefined &&
      saveSessionId !== undefined &&
      saveSequence !== undefined;
    if (hasAnyOrderingField && !hasCompleteOrdering) {
      return NextResponse.json(
        { error: "Save ordering fields must be provided together" },
        { status: 400 },
      );
    }
    if (
      saveSequence !== undefined &&
      (!Number.isSafeInteger(saveSequence) || saveSequence < 0)
    ) {
      return NextResponse.json(
        { error: "Save sequence must be a non-negative safe integer" },
        { status: 400 },
      );
    }

    const isContentChange =
      notePatch.title !== undefined ||
      notePatch.content !== undefined ||
      notePatch.contentText !== undefined;
    // A legacy client must never get an unconditional content overwrite after
    // the nullable migration. Metadata-only updates retain their old contract.
    if (isContentChange && !hasCompleteOrdering) {
      return NextResponse.json(
        { code: "note_save_conflict", reason: "ordering_required" },
        { status: 409 },
      );
    }

    let updatePayload: typeof notePatch & {
      updatedAt?: Date;
      folderId?: number | null;
      saveSessionId?: string;
      saveSequence?: number;
    } = isContentChange
      ? {
          ...notePatch,
          updatedAt: new Date(),
          saveSessionId: saveSessionId!,
          saveSequence: saveSequence!,
        }
      : { ...notePatch };

    // Auto-move note to a matching folder when tags are updated
    if (notePatch.tags !== undefined) {
      const folders = await db
        .select()
        .from(foldersTable)
        .where(eq(foldersTable.userId, user.id));

      const matchingFolder = folders.find(
        (f) =>
          f.tagRules?.length > 0 &&
          notePatch.tags!.some((t) => f.tagRules.includes(t)),
      );

      if (matchingFolder) {
        updatePayload = { ...updatePayload, folderId: matchingFolder.id };
      }
    }

    const updateWhere = isContentChange
      ? orderedNoteSaveWhere(routeParams.data.id, user.id, {
          baseRevision: baseRevision!,
          saveSessionId: saveSessionId!,
          saveSequence: saveSequence!,
        })
      : and(
          eq(notesTable.id, routeParams.data.id),
          eq(notesTable.userId, user.id),
        );
    const [note] = await db
      .update(notesTable)
      .set(updatePayload)
      .where(updateWhere)
      .returning();

    if (!note) {
      if (isContentChange) {
        return NextResponse.json(
          { code: "note_save_conflict", reason: "stale_or_cross_session" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json(UpdateNoteResponse.parse(note));
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> },
) {
  return NextResponse.json(
    { error: "Use the soft-delete or confirmed permanent-delete route" },
    { status: 405, headers: { Allow: "GET, PATCH" } },
  );
}
