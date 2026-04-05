// Scrollable note body: title input, tag row, and editor content.

import { memo } from "react";
import type { useEditor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { TagRow } from "./TagRow";

// Fix 5: memo prevents re-renders when NoteEditor re-renders but props haven't changed
export const NoteBody = memo(function NoteBody({
  editor,
  title,
  note,
  bp,
  onTitleChange,
  onAddTag,
  onRemoveTag,
}: {
  editor: ReturnType<typeof useEditor>;
  title: string;
  note: { tags?: string[] | null } | null | undefined;
  bp: "mobile" | "tablet" | "desktop";
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddTag: (tag: string) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={cn("max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12", bp === "mobile" && "pb-20")}>
        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          placeholder="Note Title"
          className="w-full text-2xl md:text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
        />
        <TagRow note={note} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
