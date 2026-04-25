import { pgTable, text, uuid, boolean, timestamp, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const TEMPLATE_CATEGORIES = ["capture", "plan", "reflect", "create", "mine"] as const;
export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

export const templatesTable = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id"),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().$type<TemplateCategory>(),
  content: jsonb("content").notNull(),
  isPreset: boolean("is_preset").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("templates_user_id_idx").on(table.userId),
  index("templates_is_preset_idx").on(table.isPreset),
]);

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ createdAt: true, updatedAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
