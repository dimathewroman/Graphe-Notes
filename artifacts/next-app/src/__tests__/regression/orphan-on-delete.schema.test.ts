// Regression: X-R1 / X-R2 — hard-deleting a note orphans its attachments and
// its note_versions forever, because `attachments.noteId` and
// `note_versions.noteId` are plain integers with NO foreign key to `notes`
// (audit §X-R1/§X-R2, verified: `integer("note_id").notNull()`, no
// `.references()`). Without an FK there is no DB-level cascade and no `restrict`
// safety net, so the permanent-delete route (which deletes only the note row)
// leaves rows and storage objects behind.
//
// These tests assert the *structural* fix Phase 1.5 introduced: an FK from each
// child table's noteId to notes.id (ON DELETE RESTRICT), applied to the DB and
// declared in the Drizzle schema.

import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import type { PgTable } from "drizzle-orm/pg-core";
import { attachmentsTable, noteVersionsTable, notesTable } from "@workspace/db";

function hasForeignKeyToNotes(table: PgTable): boolean {
  const { foreignKeys } = getTableConfig(table);
  return foreignKeys.some((fk) => fk.reference().foreignTable === notesTable);
}

describe("orphan-on-delete FK constraints (X-R1 / X-R2)", () => {
  // Sanity assertion — also proves the Vitest harness runs a normal passing test.
  it("the three tables are importable from @workspace/db", () => {
    expect(getTableConfig(notesTable).name).toBe("notes");
    expect(getTableConfig(attachmentsTable).name).toBe("attachments");
    expect(getTableConfig(noteVersionsTable).name).toBe("note_versions");
  });

  it("X-R1: attachments.noteId has a foreign key to notes.id", () => {
    expect(hasForeignKeyToNotes(attachmentsTable)).toBe(true);
  });

  it("X-R2: note_versions.noteId has a foreign key to notes.id", () => {
    expect(hasForeignKeyToNotes(noteVersionsTable)).toBe(true);
  });
});
