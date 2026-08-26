import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { orderedNoteSaveWhere } from "@/lib/note-save-ordering-sql";
import {
  acceptsOrderedNoteSave,
  type NoteSaveOrdering,
} from "@/lib/note-save-ordering";

const revision = "2026-08-26T01:02:03.456Z";
const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";

function createTableBody(sql: string, table: string): string {
  const match = sql.match(
    new RegExp(`CREATE TABLE "${table}" \\(([^]*?)\\n\\);`),
  );
  if (!match) throw new Error(`Missing ${table} in fresh schema`);
  return match[1];
}

function save(
  saveSessionId: string,
  saveSequence: number,
  baseRevision = revision,
): NoteSaveOrdering {
  return { baseRevision, saveSessionId, saveSequence };
}

describe("durable note save ordering", () => {
  it("keeps A2 when A1 commits first", () => {
    const row = { revision, saveSessionId: null, saveSequence: null };
    const a1 = save(sessionA, 1);
    const a2 = save(sessionA, 2);

    expect(acceptsOrderedNoteSave(row, a1)).toBe(true);
    const afterA1 = { revision: "server-r1", saveSessionId: sessionA, saveSequence: 1 };
    expect(acceptsOrderedNoteSave(afterA1, a2)).toBe(true);
  });

  it("keeps A2 when A2 commits before delayed A1", () => {
    const row = { revision, saveSessionId: null, saveSequence: null };
    const a1 = save(sessionA, 1);
    const a2 = save(sessionA, 2);

    expect(acceptsOrderedNoteSave(row, a2)).toBe(true);
    const afterA2 = { revision: "server-r2", saveSessionId: sessionA, saveSequence: 2 };
    expect(acceptsOrderedNoteSave(afterA2, a1)).toBe(false);
  });

  it("rejects duplicate and stale same-session sequences", () => {
    const row = { revision: "server-r2", saveSessionId: sessionA, saveSequence: 2 };

    expect(acceptsOrderedNoteSave(row, save(sessionA, 2))).toBe(false);
    expect(acceptsOrderedNoteSave(row, save(sessionA, 1))).toBe(false);
  });

  it("does not let a different session use the sequence exception", () => {
    const row = { revision: "server-r2", saveSessionId: sessionA, saveSequence: 2 };

    expect(acceptsOrderedNoteSave(row, save(sessionB, 99))).toBe(false);
  });

  it("allows a nullable migrated row only through its original server revision", () => {
    const legacyRow = { revision, saveSessionId: null, saveSequence: null };

    expect(acceptsOrderedNoteSave(legacyRow, save(sessionA, 1))).toBe(true);
    expect(
      acceptsOrderedNoteSave(
        { ...legacyRow, revision: "server-r1" },
        save(sessionA, 2),
      ),
    ).toBe(false);
  });

  it("compiles the owner, revision, session, and sequence checks into one SQL predicate", () => {
    const condition = orderedNoteSaveWhere(42, "owner-1", save(sessionA, 7));
    const compiled = new PgDialect().sqlToQuery(condition.getSQL());

    expect(compiled.sql).toContain('"notes"."id" = $1');
    expect(compiled.sql).toContain('"notes"."user_id" = $2');
    expect(compiled.sql).toContain('"notes"."updated_at" = $3');
    expect(compiled.sql).toContain('"notes"."save_session_id" = $4');
    expect(compiled.sql).toContain('"notes"."save_sequence" < $5');
    expect(compiled.params).toEqual([
      42,
      "owner-1",
      revision,
      sessionA,
      7,
    ]);
  });

  it("keeps the migration additive and backfill-free for safe rollback ordering", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "../../lib/db/drizzle/0008_note_save_ordering.sql",
      ),
      "utf8",
    );

    expect(migration).toMatch(/ADD COLUMN save_session_id uuid/);
    expect(migration).toMatch(/ADD COLUMN save_sequence bigint/);
    expect(migration).not.toMatch(/\b(UPDATE|DELETE|DROP)\b/i);
    expect(migration).not.toMatch(/NOT NULL|DEFAULT/i);
  });

  it("keeps save ordering columns on fresh notes only, matching migration and Drizzle", () => {
    const freshSchema = readFileSync(
      resolve(
        process.cwd(),
        "../../lib/db/drizzle/fresh/0000_current_schema.sql",
      ),
      "utf8",
    );
    const incrementalMigration = readFileSync(
      resolve(
        process.cwd(),
        "../../lib/db/drizzle/0008_note_save_ordering.sql",
      ),
      "utf8",
    );
    const drizzleModel = readFileSync(
      resolve(process.cwd(), "../../lib/db/src/schema/notes.ts"),
      "utf8",
    );
    const folders = createTableBody(freshSchema, "folders");
    const notes = createTableBody(freshSchema, "notes");

    for (const column of ["save_session_id", "save_sequence"]) {
      expect(folders).not.toContain(`"${column}"`);
      expect(notes).toContain(`"${column}"`);
      expect(incrementalMigration).toMatch(new RegExp(`ADD COLUMN ${column}`));
    }
    expect(drizzleModel).toContain('saveSessionId: uuid("save_session_id")');
    expect(drizzleModel).toContain('saveSequence: bigint("save_sequence"');
  });
});
