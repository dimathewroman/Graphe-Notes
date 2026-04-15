// This file configures the initialization of Sentry on the client (browser).
// The config here is used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  // DSN is public-safe (see .env.example). Hardcoded fallback ensures events
  // reach Sentry even if NEXT_PUBLIC_SENTRY_DSN isn't baked into the build.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://d68d92514a7a23c735bc9d157cad3b39@o4511108609605632.ingest.us.sentry.io/4511108611178496",

  integrations: [Sentry.replayIntegration()],

  // Sample 10% of transactions in production; 100% in dev for easier testing.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Capture 10% of sessions, 100% of sessions that contain an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  sendDefaultPii: true,
});
