import type { NextConfig } from "next";
import { resolve } from "node:path";

const publicApiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const publicSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!publicApiOrigin) {
  throw new Error(
    "Static-client builds require NEXT_PUBLIC_API_ORIGIN for the hosted HTTPS API.",
  );
}

if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
  throw new Error(
    "Static-client builds require NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const nextConfig: NextConfig = {
  // This application is deliberately a client-only deployment target. It has
  // no route handlers, middleware, rewrites, or response headers from the
  // hosted application, which remain owned by artifacts/next-app.
  output: "export",
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@workspace/api-client-react", "@workspace/api-zod"],
  webpack(config) {
    // Browser-safe UI is deliberately shared from the hosted application.
    // The graph guard remains the authority for excluding hosted server owners.
    config.resolve.alias["@"] = resolve(import.meta.dirname, "../next-app/src");
    config.resolve.alias["@lib"] = resolve(import.meta.dirname, "../../lib");
    config.resolve.alias["@sentry/nextjs"] = resolve(
      import.meta.dirname,
      "./lib/sentry-static.ts",
    );
    // Avoid the Node/jsdom export while prerendering a browser-only bundle.
    config.resolve.alias["isomorphic-dompurify"] = resolve(
      import.meta.dirname,
      "../next-app/node_modules/isomorphic-dompurify/dist/browser.mjs",
    );
    return config;
  },
  env: {
    NEXT_PUBLIC_STATIC_CLIENT: "1",
    NEXT_PUBLIC_API_ORIGIN: publicApiOrigin,
    NEXT_PUBLIC_POSTHOG_INGEST_HOST: process.env.NEXT_PUBLIC_POSTHOG_INGEST_HOST ?? "",
    NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseAnonKey,
  },
};

export default nextConfig;
