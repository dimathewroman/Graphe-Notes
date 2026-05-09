"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { getGetNoteQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { IMAGE_MIME_TYPES, BROWSER_RENDERABLE_IMAGE_TYPES, HEIC_MIME_TYPES, formatBytes } from "@/lib/attachment-limits";
import { useDemoMode } from "@/lib/demo-context";
import { useAppStore } from "@/store";

export interface AttachmentRecord {
  id: string;
  noteId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string | null;    // v1 legacy; null for v2 rows
  masterPath?: string | null;    // v2: path to master file in Supabase Storage
  proxyPath?: string | null;     // v2: path to AVIF proxy in Supabase Storage
  masterFormat?: string | null;  // 'jpg' | 'png'
  masterUrl?: string | null;     // v2: signed URL for master (download)
  width?: number | null;
  height?: number | null;
  createdAt: string;
  deletedAt?: string | null;
  url: string | null;            // proxy signed URL for display (v2) or storagePath URL (v1)
  noteTitle?: string | null;
}

// Demo store for in-memory attachments during demo mode
const demoAttachments: AttachmentRecord[] = [];
let demoIdCounter = 1;

function isHeicFile(file: File): boolean {
  if (HEIC_MIME_TYPES.has(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "heic" || ext === "heif";
}

/**
 * Convert a HEIC/HEIF file to a JPEG object URL for browser preview.
 *
 * Tier 1 — Safari: createImageBitmap (native OS HEIC codec) → Canvas → JPEG blob URL.
 * Tier 2 — Chrome/Firefox: heic2any pure-JS decoder. Dynamically imported so the
 *           bundle only loads when a HEIC file is actually selected.
 * Tier 3 — Final fallback: SVG placeholder. Guarantees no broken image icon.
 */
async function heicToPreviewUrl(file: File): Promise<string> {
  // Tier 1: Safari native decode
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    return await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        blob => (blob ? resolve(URL.createObjectURL(blob)) : reject()),
        "image/jpeg",
        0.9,
      );
    });
  } catch { /* fall through to tier 2 */ }

  // Tier 2: heic2any pure-JS decoder
  // heic2any ships as CJS; webpack puts module.exports on both the namespace
  // object and .default — try both so neither module format breaks us.
  try {
    const mod = await import("heic2any");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn: (o: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]> =
      (mod as any).default ?? mod;
    const jpeg = await fn({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const out = Array.isArray(jpeg) ? jpeg[0] : jpeg;
    return URL.createObjectURL(out);
  } catch (e) {
    console.error("[heicToPreviewUrl] heic2any failed:", e);
  }

  // Tier 3: SVG placeholder — always renderable, never a broken icon
  const name = file.name.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
    <rect width="320" height="200" rx="8" fill="#f3f4f6"/>
    <text x="160" y="88" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" fill="#6b7280">HEIC image</text>
    <text x="160" y="112" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" fill="#9ca3af">${name}</text>
    <text x="160" y="148" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="#d1d5db">Sign up to upload &amp; convert</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getDemoAttachments() { return [...demoAttachments]; }

export function getNoteAttachmentsQueryKey(noteId: number) {
  return ["/api/attachments/note", noteId] as const;
}
export function getAllAttachmentsQueryKey() {
  return ["/api/attachments/all"] as const;
}

export function useNoteAttachments(noteId: number | null) {
  const isDemo = useDemoMode();
  return useQuery({
    queryKey: getNoteAttachmentsQueryKey(noteId ?? 0),
    queryFn: async (): Promise<AttachmentRecord[]> => {
      if (isDemo) {
        return demoAttachments.filter(a => a.noteId === noteId && !a.deletedAt);
      }
      const res = await authenticatedFetch(`/api/attachments/note/${noteId}`);
      if (!res.ok) throw new Error("Failed to load attachments");
      return res.json();
    },
    enabled: !!noteId,
    staleTime: 30_000,
  });
}

export function useAllAttachments() {
  const isDemo = useDemoMode();
  return useQuery({
    queryKey: getAllAttachmentsQueryKey(),
    queryFn: async (): Promise<AttachmentRecord[]> => {
      if (isDemo) return demoAttachments.filter(a => !a.deletedAt);
      const res = await authenticatedFetch("/api/attachments/all");
      if (!res.ok) throw new Error("Failed to load attachments");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();
  return useMutation({
    mutationFn: async ({ id, noteId }: { id: string; noteId?: number }) => {
      if (isDemo) {
        // Soft-delete in demo mode: mark deleted_at so it disappears from UI
        const idx = demoAttachments.findIndex(a => a.id === id);
        if (idx !== -1) demoAttachments[idx] = { ...demoAttachments[idx], deletedAt: new Date().toISOString() };
        return;
      }
      const res = await authenticatedFetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attachments"] });
      // Refresh the note so editor reflects the stripped inline image
      if (noteId) queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) });
    },
  });
}

// Core upload logic shared by toolbar button and drag-and-drop
export function useUploadAttachment(noteId: number | null) {
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();
  const [uploading, setUploading] = useState<string[]>([]); // file names being uploaded

  const upload = useCallback(async (file: File): Promise<AttachmentRecord | null> => {
    if (!noteId) {
      toast.error("Select a note before uploading");
      return null;
    }
    setUploading(prev => [...prev, file.name]);
    try {
      if (isDemo) {
        // Demo: create a displayable URL for the file.
        // HEIC/HEIF cannot be decoded by Chrome as a raw blob URL, so convert
        // via the 3-tier heicToPreviewUrl pipeline. We also keep a blob URL of
        // the original so the Download button serves the real HEIC file.
        let objectUrl: string;
        let fileType = file.type;
        let masterUrl: string | undefined;
        if (isHeicFile(file)) {
          masterUrl = URL.createObjectURL(file); // original HEIC for download
          objectUrl = await heicToPreviewUrl(file); // JPEG or SVG for display
          fileType = "image/jpeg"; // heicToPreviewUrl always returns something renderable
        } else {
          objectUrl = URL.createObjectURL(file);
        }
        const record: AttachmentRecord = {
          id: `demo-${demoIdCounter++}`,
          noteId,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          storagePath: null,
          createdAt: new Date().toISOString(),
          url: objectUrl,
          masterUrl,
        };
        demoAttachments.push(record);
        queryClient.invalidateQueries({ queryKey: ["/api/attachments"] });
        return record;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("note_id", String(noteId));

      const res = await authenticatedFetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Upload failed");
        return null;
      }

      const record: AttachmentRecord = await res.json();
      queryClient.invalidateQueries({ queryKey: getNoteAttachmentsQueryKey(noteId) });
      queryClient.invalidateQueries({ queryKey: getAllAttachmentsQueryKey() });
      return record;
    } catch {
      toast.error("Upload failed");
      return null;
    } finally {
      setUploading(prev => prev.filter(n => n !== file.name));
    }
  }, [noteId, isDemo, queryClient]);

  return { upload, uploading };
}

export function isImageType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export { formatBytes };
