// Loads Sentry client config (init, replay, etc.).
// PostHog is initialized via PostHogProvider in src/components/PostHogProvider.tsx.
import "../sentry.client.config";
import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
