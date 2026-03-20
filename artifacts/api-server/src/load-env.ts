import { config } from "dotenv";
import path from "path";

// Load .env from repo root via process.cwd() — avoids import.meta.url which
// becomes undefined when esbuild bundles to CJS. Silently no-ops in production
// where the file doesn't exist and vars are injected by the environment.
config({ path: path.resolve(process.cwd(), ".env"), override: false });
