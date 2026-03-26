import { sql } from "drizzle-orm";
import { index, pgSchema, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

// Reference to Supabase's built-in auth.users table (auth schema, not public)
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", { id: uuid("id") });

export const userApiKeysTable = pgTable(
  "user_api_keys",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    // Expected values: graphe_free, google_ai_studio, openai, anthropic, local_llm
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    endpointUrl: text("endpoint_url"),
    modelOverride: text("model_override"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("user_api_keys_user_id_provider_unique").on(table.userId, table.provider),
    index("user_api_keys_user_id_idx").on(table.userId),
  ],
);

export type UserApiKey = typeof userApiKeysTable.$inferSelect;
export type InsertUserApiKey = typeof userApiKeysTable.$inferInsert;
