"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { getGetNoteQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { IMAGE_MIME_TYPES, formatBytes } from "@/lib/attachment-limits";
import { useDemoMode } from "@/lib/demo-context";
import { useAppStore } from "@/store";

export interface AttachmentRecord {
  id: string;
  noteId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
  deletedAt?: string | null;
  url: string | null;
  noteTitle?: string | null;
}

// Demo store for in-memory attachments during demo mode
const demoAttachments: AttachmentRecord[] = [];
let demoIdCounter = 1;

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
        // Demo: use object URL, store in memory
        const objectUrl = URL.createObjectURL(file);
        const record: AttachmentRecord = {
          id: `demo-${demoIdCounter++}`,
          noteId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          storagePath: "",
          createdAt: new Date().toISOString(),
          url: objectUrl,
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
