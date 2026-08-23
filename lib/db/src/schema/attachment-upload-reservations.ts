import {
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const privateSchema = pgSchema("private");

/** Server-only inventory for objects written before their attachment commits. */
export const attachmentUploadReservationsTable = privateSchema.table(
  "attachment_upload_reservations",
  {
    id: uuid("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    noteId: integer("note_id").notNull(),
    state: text("state").notNull().default("uploading"),
    leaseToken: uuid("lease_token").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
    }).notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastErrorCode: text("last_error_code"),
    storagePath: text("storage_path"),
    masterPath: text("master_path"),
    proxyPath: text("proxy_path"),
    attachment: jsonb("attachment").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attachment_upload_reservations_due_idx").on(
      table.state,
      table.nextAttemptAt,
      table.leaseExpiresAt,
    ),
    index("attachment_upload_reservations_lease_idx").on(table.leaseToken),
    check(
      "attachment_upload_reservations_state_check",
      sql`${table.state} in ('uploading', 'cleanup_pending')`,
    ),
    check(
      "attachment_upload_reservations_path_check",
      sql`${table.storagePath} is not null or ${table.masterPath} is not null or ${table.proxyPath} is not null`,
    ),
    check(
      "attachment_upload_reservations_error_check",
      sql`${table.lastErrorCode} is null or length(${table.lastErrorCode}) <= 64`,
    ),
  ],
);

export type AttachmentUploadReservation =
  typeof attachmentUploadReservationsTable.$inferSelect;
