import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set.",
  );
}

export const pool = new Pool({ connectionString: dbUrl });
export const db = drizzle(pool, { schema });

export * from "./schema";
