import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL must be set.");
}
const dbUrl = process.env.SUPABASE_DB_URL;

export const pool = new Pool({
  connectionString: dbUrl,
  max: 5,                       // Small pool suitable for serverless
  idleTimeoutMillis: 10000,     // Release idle connections after 10s
  connectionTimeoutMillis: 5000, // Fail fast if pool is exhausted
});
export const db = drizzle(pool, { schema });

export * from "./schema";
