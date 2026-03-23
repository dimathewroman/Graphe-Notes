import { sql } from "drizzle-orm";
import { pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Reference to Supabase's built-in auth.users table (auth schema, not public)
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", { id: uuid("id") });

export const userSettingsTable = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .references(() => authUsers.id, { onDelete: "cascade" }),
  activeAiProvider: text("active_ai_provider"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;
export type InsertUserSettings = typeof userSettingsTable.$inferInsert;
