import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

const crossPlatformPort = 3101;

/**
 * Explicit opt-in browser smoke matrix. The default config remains the owner
 * of the full Chromium and authenticated suites.
 */
export default defineConfig({
  ...baseConfig,
  testDir: "./cross-platform-e2e",
  testMatch: /14-cross-platform-smoke\.spec\.ts/,
  use: {
    ...baseConfig.use,
    baseURL: `http://localhost:${crossPlatformPort}`,
  },
  projects: [
    {
      name: "smoke-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "smoke-webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "smoke-firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "smoke-mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "smoke-mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: process.env.CI
      ? `pnpm --filter @workspace/next-app exec next start -p ${crossPlatformPort}`
      : `pnpm --filter @workspace/next-app exec next dev -p ${crossPlatformPort}`,
    url: `http://localhost:${crossPlatformPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // Demo mode needs only the non-secret placeholders documented in .env.example.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key",
    },
  },
});
