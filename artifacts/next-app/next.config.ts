import type { NextConfig } from "next";
import path from "path";
import { config as loadEnv } from "dotenv";

// Load .env from repo root (2 levels up from artifacts/next-app/)
loadEnv({ path: path.resolve(__dirname, "../../.env"), override: false });

const nextConfig: NextConfig = {
  env: {
    // Expose SUPABASE_URL / ANON_KEY under the NEXT_PUBLIC_ prefix
    // so they're available on the client side. Falls back to root .env vars.
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  },
};

export default nextConfig;
