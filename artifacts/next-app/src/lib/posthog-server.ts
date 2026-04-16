import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

// No-op stub used when NEXT_PUBLIC_POSTHOG_KEY is absent (e.g. local dev without .env credentials).
// Prevents vault/AI routes from throwing a 500 just because PostHog isn't configured.
const noopClient = {
  capture: () => {},
  shutdown: async () => {},
} as unknown as PostHog;

export function getPostHogClient(): PostHog {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return noopClient;

  if (!posthogClient) {
    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
