import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // Run tests serially against the dev server — parallel workers overwhelm
  // Next.js dev mode and cause intermittent auth-spinner timeouts.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 10_000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm --filter @workspace/next-app run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
