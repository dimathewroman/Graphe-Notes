import { pgTable, text, integer, varchar, timestamp, uuid, index, boolean } from "drizzle-orm/pg-core";

export const attachmentsTable = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: integer("note_id").notNull(),
  userId: varchar("user_id").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  // v1 legacy: single AVIF path. Nullable — new v2 rows set this to null.
  storagePath: text("storage_path"),
  displayMode: text("display_mode"),
  // v2 master + proxy paths
  masterPath: text("master_path"),
  proxyPath: text("proxy_path"),
  masterFormat: text("master_format"),      // 'jpg' | 'png' | 'gif'
  proxyFormat: text("proxy_format").default("avif"),  // 'avif' | 'gif' (fallback)
  isAnimated: boolean("is_animated").default(false),
  masterSizeBytes: integer("master_size_bytes"),
  proxySizeBytes: integer("proxy_size_bytes"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("attachments_user_id_idx").on(table.userId),
  index("attachments_note_id_idx").on(table.noteId),
  index("attachments_note_id_created_at_idx").on(table.noteId, table.createdAt),
]);

export type Attachment = typeof attachmentsTable.$inferSelect;
export type InsertAttachment = typeof attachmentsTable.$inferInsert;
