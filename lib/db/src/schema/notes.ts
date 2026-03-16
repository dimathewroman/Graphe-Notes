import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const noteVersionsTable = pgTable("note_versions", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentText: text("content_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
