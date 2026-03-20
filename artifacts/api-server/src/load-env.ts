import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from repo root (3 levels up from artifacts/api-server/src/).
// Silently no-ops if the file doesn't exist or vars are already set.
config({ path: path.resolve(__dirname, "../../../.env"), override: false });
