import { and, eq, lt, or } from "drizzle-orm";
import { notesTable } from "@workspace/db";
import type { NoteSaveOrdering } from "./note-save-ordering";

/**
 * Keep owner, opaque base revision, and same-session sequence fencing in one
 * WHERE clause so PostgreSQL evaluates them against the same row version.
 */
export function orderedNoteSaveWhere(
  noteId: number,
  userId: string,
  ordering: NoteSaveOrdering,
) {
  return and(
    eq(notesTable.id, noteId),
    eq(notesTable.userId, userId),
    or(
      eq(notesTable.updatedAt, new Date(ordering.baseRevision)),
      and(
        eq(notesTable.saveSessionId, ordering.saveSessionId),
        lt(notesTable.saveSequence, ordering.saveSequence),
      ),
    ),
  )!;
}
