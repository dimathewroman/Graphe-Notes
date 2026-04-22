"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, RotateCcw, Trash2, MoreVertical, AlertCircle } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Table, TableHeader, TableCell } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNote,
  useRestoreNote,
  usePermanentDeleteNote,
  getGetNotesQueryKey,
  getGetNoteQueryKey,
} from "@workspace/api-client-react";
import type { Note } from "@workspace/api-client-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";
import { useBreakpoint } from "@/hooks/use-mobile";
import { useDemoMode } from "@/lib/demo-context";

export function RecentlyDeletedDetail() {
  const {
    selectedNoteId, selectNote, setMobileView,
    setFilter, isVaultUnlocked,
    isSidebarOpen, isNoteListOpen, toggleSidebar, toggleNoteList,
  } = useAppStore();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);

  // Fetch note (non-demo reads from API; demo reads from cache)
  const { data: apiNote } = useGetNote(selectedNoteId!, {
    query: {
      enabled: !isDemo && !!selectedNoteId,
      queryKey: getGetNoteQueryKey(selectedNoteId!),
    },
  });

  const demoNote = isDemo && selectedNoteId
    ? (queryClient.getQueryData<Note & { _demoDeleted?: boolean }>(getGetNoteQueryKey(selectedNoteId)))
    : undefined;

  const note = (isDemo ? demoNote : apiNote) as (Note & { _demoDeleted?: boolean; _isQuickBit?: boolean }) | undefined;

  // Read-only Tiptap editor
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: false }),
      UnderlineExt,
      TextStyle,
      FontSize,
      Color,
      FontFamily,
      Image.configure({ inline: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: note?.content || "",
  });

  // Update editor content when note changes
  useEffect(() => {
    if (editor && note?.content !== undefined) {
      const current = editor.getHTML();
      if (current !== note.content) {
        editor.commands.setContent(note.content || "");
      }
    }
  }, [editor, note?.content]);

  // Mutations
  const restoreMut = useRestoreNote();
  const permanentDeleteMut = usePermanentDeleteNote();

  const handleRestore = async () => {
    if (!selectedNoteId || !note) return;
    if (isDemo) {
      const existing = queryClient.getQueryData<any>(getGetNoteQueryKey(selectedNoteId));
      if (existing) {
        queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), {
          ...existing,
          _demoDeleted: false,
          deletedAt: null,
          autoDeleteAt: null,
          deletedReason: null,
        });
      }
      selectNote(null);
      if (note.vaulted) {
        // Silently returns to vault — no navigation needed
        return;
      }
      setFilter("all");
      return;
    }
    try {
      await restoreMut.mutateAsync({ id: selectedNoteId });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectNote(null);
      if (note.vaulted) {
        // Vault notes return silently — no navigation
        return;
      }
      setFilter("all");
      // Re-select the note in All Notes after filter switch
      selectNote(selectedNoteId);
    } catch {}
  };

  const handlePermanentDelete = async () => {
    if (!selectedNoteId) return;
    setShowConfirmDelete(false);
    if (isDemo) {
      const existing = queryClient.getQueryData<any>(getGetNoteQueryKey(selectedNoteId));
      if (existing) {
        queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), {
          ...existing,
          _demoDeleted: false,
          _demoPermanentlyDeleted: true,
        });
      }
      selectNote(null);
      if (bp !== "desktop") setMobileView("list");
      return;
    }
    try {
      await permanentDeleteMut.mutateAsync({ id: selectedNoteId, data: { confirm: true } });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    } catch {}
    selectNote(null);
    if (bp !== "desktop") setMobileView("list");
  };

  const handleBack = () => {
    selectNote(null);
    setMobileView("list");
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isVaultNote = note.vaulted;

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
      {/* Header */}
      <header className="h-14 border-b border-panel-border flex items-center justify-between px-2 md:px-4 shrink-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {bp === "mobile" && (
            <button
              onClick={handleBack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
            <div className="flex items-center gap-0.5 mr-2">
              {!isSidebarOpen && (
                <IconButton onClick={toggleSidebar} title="Show sidebar">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                </IconButton>
              )}
              {!isNoteListOpen && (
                <IconButton onClick={toggleNoteList} title="Show note list">
                  <svg className="w-4 h-4 scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                </IconButton>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          {/* Desktop + tablet: Restore + separator + Permanent Delete icons */}
          {bp !== "mobile" && (
            <>
              <IconButton
                onClick={handleRestore}
                disabled={restoreMut.isPending}
                title="Restore note"
                className="hover:text-emerald-500 hover:bg-emerald-500/10"
              >
                <RotateCcw className="w-4 h-4" />
              </IconButton>
              <div className="w-px h-4 bg-panel-border mx-1" />
              <IconButton
                onClick={() => setShowConfirmDelete(true)}
                disabled={permanentDeleteMut.isPending}
                title="Permanently delete"
                className="hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </>
          )}

          {/* Mobile only: overflow menu */}
          {bp === "mobile" && (
            <div className="relative">
              <IconButton onClick={() => setShowOverflow(!showOverflow)} active={showOverflow}>
                <MoreVertical className="w-4 h-4" />
              </IconButton>
              {showOverflow && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-popover border border-panel-border rounded-xl shadow-2xl py-1">
                  <button
                    onClick={() => { setShowOverflow(false); handleRestore(); }}
                    disabled={restoreMut.isPending}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </button>
                  <div className="h-px bg-panel-border mx-2 my-1" />
                  <button
                    onClick={() => { setShowOverflow(false); setShowConfirmDelete(true); }}
                    disabled={permanentDeleteMut.isPending}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Permanently Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Read-only banner */}
      <div className="px-4 py-2.5 border-b border-panel-border bg-amber-500/5 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 shrink-0">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>This note is in Recently Deleted. Restore it to edit again.</span>
      </div>

      {/* Confirm permanent delete dialog */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-popover border border-panel-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-2">Permanently Delete</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isVaultNote
                ? "This will permanently delete a vault note. This cannot be undone."
                : "Permanently delete this note? This cannot be undone."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-panel transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn("flex-1 overflow-y-auto", bp === "mobile" && "pb-28")}>
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12">
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
            {note.title || "Untitled Note"}
          </h1>
          {note.tags && note.tags.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 mb-8">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <EditorContent
            editor={editor}
            className="prose prose-sm dark:prose-invert max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px]"
          />
        </div>
      </div>

      {/* Mobile bottom action bar */}
      {bp === "mobile" && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-panel-border bg-background/90 backdrop-blur-md px-4 py-3 flex gap-3 z-20">
          <button
            onClick={handleRestore}
            disabled={restoreMut.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Restore
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            disabled={permanentDeleteMut.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Forever
          </button>
        </div>
      )}
    </div>
  );
}
