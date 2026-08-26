import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";

type AttachmentDownloadTarget = {
  attachmentId: string | null;
  src: string;
};

function downloadPathFor({
  attachmentId,
  src,
}: AttachmentDownloadTarget): string | null {
  if (attachmentId) {
    return `/api/attachments/download?id=${encodeURIComponent(attachmentId)}`;
  }

  const match = src.match(/\/object\/(?:sign|public)\/([^?]+)/);
  return match
    ? `/api/attachments/download?path=${encodeURIComponent(match[1])}`
    : null;
}

function downloadName(response: Response, fallback: string): string {
  const contentDisposition = response.headers.get("content-disposition");
  const match = contentDisposition?.match(/filename="?([^";]+)"?/iu);
  return match?.[1] || fallback || "image";
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

/**
 * Downloads a persisted attachment through the application API. The shared
 * authenticatedFetch boundary validates the relative path before it adds bearer
 * or vault-proof headers, then resolves the configured static-client origin.
 */
export async function downloadPersistedAttachment(
  target: AttachmentDownloadTarget,
  fallbackFilename: string,
): Promise<boolean> {
  const path = downloadPathFor(target);
  if (!path) return false;

  const response = await authenticatedFetch(path);
  if (!response.ok) {
    throw new Error(`Attachment download failed (${response.status}).`);
  }

  triggerBlobDownload(
    await response.blob(),
    downloadName(response, fallbackFilename),
  );
  return true;
}
