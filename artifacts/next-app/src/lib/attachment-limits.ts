export type StorageTier = "free" | "pro" | "admin";

export const TIER_LIMITS: Record<StorageTier, { maxFileSize: number; maxTotalStorage: number | null }> = {
  free: { maxFileSize: 10 * 1024 * 1024, maxTotalStorage: 100 * 1024 * 1024 },
  pro:  { maxFileSize: 25 * 1024 * 1024, maxTotalStorage: 1024 * 1024 * 1024 },
  admin: { maxFileSize: Infinity, maxTotalStorage: null },
};

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/markdown", "application/json",
  "application/zip",
]);

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
]);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
