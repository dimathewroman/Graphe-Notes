export type StorageTier = "free" | "pro" | "admin";

export const TIER_LIMITS: Record<StorageTier, { maxFileSize: number; maxTotalStorage: number | null }> = {
  free: { maxFileSize: 10 * 1024 * 1024, maxTotalStorage: 100 * 1024 * 1024 },
  pro:  { maxFileSize: 25 * 1024 * 1024, maxTotalStorage: 1024 * 1024 * 1024 },
  admin: { maxFileSize: Infinity, maxTotalStorage: null },
};

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "image/heic", "image/heif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/markdown", "application/json",
  "application/zip",
]);

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "image/heic", "image/heif",
]);

// MIME types that identify HEIC/HEIF input that must be converted before storage
export const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

// Image types browsers can render natively without server conversion.
// Excludes HEIC/HEIF — those need sharp/heic-convert to produce a renderable format.
export const BROWSER_RENDERABLE_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
]);

// Animated GIF caps enforced before encoding to protect server memory / timeout budget.
export const ANIMATED_GIF_MAX_BYTES = 15 * 1024 * 1024; // 15 MB raw GIF
export const ANIMATED_GIF_MAX_FRAMES = 600;              // ~20 s at 30 fps

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
