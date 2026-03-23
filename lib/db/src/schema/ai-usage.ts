import { sql } from "drizzle-orm";
import { index, integer, pgSchema, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

// Reference to Supabase's built-in auth.users table (auth schema, not public)
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", { id: uuid("id") });

export const aiUsageTable = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    requestsThisHour: integer("requests_this_hour").notNull().default(0),
    hourWindowStart: timestamp("hour_window_start", { withTimezone: true }).notNull(),
    requestsThisMonth: integer("requests_this_month").notNull().default(0),
    monthWindowStart: timestamp("month_window_start", { withTimezone: true }).notNull(),
    totalTokensUsed: integer("total_tokens_used"),
    lastRequestAt: timestamp("last_request_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_usage_user_id_idx").on(table.userId)],
);

export type AiUsage = typeof aiUsageTable.$inferSelect;
export type InsertAiUsage = typeof aiUsageTable.$inferInsert;
