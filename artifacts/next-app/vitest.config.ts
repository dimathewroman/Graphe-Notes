import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

// Unit/component tests only. Playwright e2e specs live in ./e2e and are run by
// `test:e2e` — we scope `include` to ./src so Vitest never picks them up (they
// import from @playwright/test and would fail under Vitest).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@workspace/db": resolve(rootDir, "../../lib/db/src/index.ts"),
      "@lib": resolve(rootDir, "../../lib"),
      "@": resolve(rootDir, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
