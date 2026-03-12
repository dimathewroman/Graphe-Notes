import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const smartFoldersTable = pgTable("smart_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tagRules: text("tag_rules").array().notNull().default([]),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSmartFolderSchema = createInsertSchema(smartFoldersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSmartFolder = z.infer<typeof insertSmartFolderSchema>;
export type SmartFolder = typeof smartFoldersTable.$inferSelect;
