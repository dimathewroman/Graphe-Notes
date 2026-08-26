// A static bundle has no approved error-ingest endpoint in this slice. Keep the
// shared UI callable while ensuring neither server instrumentation nor a hidden
// telemetry fallback is bundled.
export function captureException(_error: unknown, _context?: unknown): void {}
