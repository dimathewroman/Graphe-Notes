// Scrollable note body: title input, tag row, editor content, and attachment panel.

import { memo, useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { TagRow } from "./TagRow";
import { AttachmentPanel, UploadingCard } from "./AttachmentPanel";
import { useUploadAttachment, isImageType } from "@/hooks/use-attachments";
import { ALLOWED_MIME_TYPES } from "@/lib/attachment-limits";
import { toast } from "sonner";

// Fix 5: memo prevents re-renders when NoteEditor re-renders but props haven't changed
export const NoteBody = memo(function NoteBody({
  editor,
  title,
  note,
  noteId,
  bp,
  keyboardHeight = 0,
  onTitleChange,
  onAddTag,
  onRemoveTag,
  onDeleteImage,
}: {
  editor: Editor | null;
  title: string;
  note: { tags?: string[] | null } | null | undefined;
  noteId: number | null;
  bp: "mobile" | "tablet" | "desktop";
  keyboardHeight?: number;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddTag: (tag: string) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
  onDeleteImage?: (storagePath: string) => void;
}) {
  const { upload, uploading } = useUploadAttachment(noteId);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const handleFile = useCallback(async (file: File, dropPosition?: { x: number; y: number }) => {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("This file type isn't supported.");
      return;
    }
    if (isImageType(file.type)) {
      const record = await upload(file);
      if (record?.url && editor) {
        if (dropPosition) {
          // Resolve the document position at the drop coordinates and insert there
          const resolved = editor.view.posAtCoords({ left: dropPosition.x, top: dropPosition.y });
          const insertPos = resolved?.pos ?? null;
          if (insertPos !== null) {
            editor.chain().focus().setTextSelection(insertPos).setImage({ src: record.url, alt: file.name }).run();
          } else {
            editor.chain().focus().setImage({ src: record.url, alt: file.name }).run();
          }
        } else {
          editor.chain().focus().setImage({ src: record.url, alt: file.name }).run();
        }
      }
    } else {
      await upload(file);
    }
  }, [upload, editor]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;
    for (const file of files) {
      await handleFile(file, { x: e.clientX, y: e.clientY });
    }
  }, [handleFile]);

  return (
    <div
      className="flex-1 overflow-y-auto relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 z-10 bg-primary/5 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center pointer-events-none">
          <p className="text-primary text-sm font-medium">Drop files here</p>
        </div>
      )}
      <div
        className={cn("max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12", bp === "mobile" && "pb-20")}
        // On mobile the toolbar is `position: fixed` above the soft keyboard,
        // so it covers the bottom slice of the scrollable body. Without extra
        // bottom padding the user can't scroll the last few lines of content
        // above the toolbar — they stay trapped behind it. Grow the runway by
        // the keyboard height (the base `pb-20` already covers the toolbar
        // chrome itself when no keyboard is open).
        style={bp === "mobile" && keyboardHeight > 0 ? { paddingBottom: `calc(5rem + ${keyboardHeight}px)` } : undefined}
      >
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          placeholder="Note Title"
          className="w-full text-2xl md:text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
        />
        <TagRow note={note} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
        <EditorContent editor={editor} />

        {/* Uploading placeholders */}
        {uploading.length > 0 && (
          <div className="mt-6 flex flex-col gap-1.5">
            {uploading.map(name => <UploadingCard key={name} fileName={name} />)}
          </div>
        )}

        {/* Attachment panel (non-images only) */}
        {noteId && <AttachmentPanel noteId={noteId} onDeleteImage={onDeleteImage} />}
      </div>
    </div>
  );
});
