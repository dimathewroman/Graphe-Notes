// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { scrubSecretsFromBreadcrumb } from "@/lib/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeBreadcrumb: scrubSecretsFromBreadcrumb,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Disable automatic OpenTelemetry setup to prevent @opentelemetry/instrumentation-pg from
  // wrapping the pg Pool. In Vercel serverless, the OTel pg instrumentation holds connections
  // open inside spans, exhausting the pool and causing all queries to fail with
  // "Error: Failed query". Error monitoring and onRequestError still work without OTel.
  skipOpenTelemetrySetup: true,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do NOT send user PII by default (§S). We opt into specific context per event
  // instead of shipping IPs/headers/cookies wholesale.
  sendDefaultPii: false,
});
