import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";
import { config as loadEnv } from "dotenv";

// Load .env from repo root (2 levels up from artifacts/next-app/)
loadEnv({ path: path.resolve(__dirname, "../../.env"), override: false });

// Dev only: let the browser reach local inference endpoints (Ollama, LM Studio,
// the Claude proxy on :8788) that the client-side local_llm provider fetches.
// `next build` runs with NODE_ENV=production, so this is empty in every deployed
// build — production CSP never allows localhost.
const devConnectSrc =
  process.env.NODE_ENV !== "production" ? " http://localhost:* http://127.0.0.1:* ws://localhost:*" : "";

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://us.i.posthog.com https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  // Sentry ingest endpoints must be in connect-src so error reports are not blocked.
  // worker-src must be set explicitly (with blob:) because Sentry's SDK uses a blob:
  // worker for its replay / profiling features and the script-src fallback does not
  // include blob:, which causes a CSP violation.
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io${devConnectSrc}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/api-client-react", "@workspace/api-zod"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Supabase Storage signed and public URLs
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/**" },
      // Google OAuth profile images
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  env: {
    // Expose SUPABASE_URL / ANON_KEY under the NEXT_PUBLIC_ prefix
    // so they're available on the client side. Falls back to root .env vars.
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "dimathew-roman",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
