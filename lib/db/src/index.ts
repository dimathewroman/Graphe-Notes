import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const dbUrl = process.env.SUPABASE_DB_URL;

export const pool = new Pool({
  connectionString: dbUrl,
  max: 1,                        // One connection per Lambda instance (serverless processes are single-threaded)
  idleTimeoutMillis: 5000,       // Release idle connections quickly between invocations
  connectionTimeoutMillis: 5000, // Fail fast if pool is exhausted
});
export const db = drizzle(pool, { schema });

export * from "./schema";
