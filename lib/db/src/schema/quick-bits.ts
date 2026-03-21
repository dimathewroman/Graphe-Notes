import { pgTable, text, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quickBitsTable = pgTable("quick_bits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  contentText: text("content_text"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quickBitSettingsTable = pgTable("quick_bit_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").unique(),
  defaultExpirationDays: integer("default_expiration_days").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuickBitSchema = createInsertSchema(quickBitsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuickBit = z.infer<typeof insertQuickBitSchema>;
export type QuickBit = typeof quickBitsTable.$inferSelect;

export const insertQuickBitSettingsSchema = createInsertSchema(quickBitSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuickBitSettings = z.infer<typeof insertQuickBitSettingsSchema>;
export type QuickBitSettings = typeof quickBitSettingsTable.$inferSelect;
