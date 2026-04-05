import { pgTable, text, integer, varchar, timestamp, uuid, index } from "drizzle-orm/pg-core";

export const attachmentsTable = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: integer("note_id").notNull(),
  userId: varchar("user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  storagePath: text("storage_path").notNull(),
  displayMode: text("display_mode"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("attachments_user_id_idx").on(table.userId),
  index("attachments_note_id_idx").on(table.noteId),
  index("attachments_note_id_created_at_idx").on(table.noteId, table.createdAt),
]);

export type Attachment = typeof attachmentsTable.$inferSelect;
export type InsertAttachment = typeof attachmentsTable.$inferInsert;
