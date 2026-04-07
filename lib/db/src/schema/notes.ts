import { pgTable, text, serial, integer, boolean, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  contentText: text("content_text"),
  folderId: integer("folder_id"),
  tags: text("tags").array().notNull().default([]),
  pinned: boolean("pinned").notNull().default(false),
  favorite: boolean("favorite").notNull().default(false),
  coverImage: text("cover_image"),
  vaulted: boolean("vaulted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  autoDeleteAt: timestamp("auto_delete_at", { withTimezone: true }),
  deletedReason: text("deleted_reason"), // 'deleted' | 'expired'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("notes_user_id_deleted_at_idx").on(table.userId, table.deletedAt),
  index("notes_folder_id_idx").on(table.folderId),
]);

export const noteVersionsTable = pgTable("note_versions", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentText: text("content_text"),
  // User-defined name for this version (e.g. "Before AI rewrite", "Final draft").
  // NULL for unnamed versions.
  label: text("label"),
  // What triggered this version. One of: 'manual_save', 'auto_save',
  // 'pre_ai_rewrite', 'restore', 'auto_close'. NULL for legacy rows.
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("note_versions_note_id_created_at_idx").on(table.noteId, table.createdAt),
]);

export const vaultSettingsTable = pgTable("vault_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;
export type NoteVersion = typeof noteVersionsTable.$inferSelect;
export type VaultSettings = typeof vaultSettingsTable.$inferSelect;
