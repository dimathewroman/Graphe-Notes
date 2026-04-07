import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import { CustomImage } from "./editor/CustomImageExtension";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableHeader, TableCell } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import SuperscriptExt from "@tiptap/extension-superscript";
import SubscriptExt from "@tiptap/extension-subscript";

import { useAppStore } from "@/store";
import {
  useGetNote, useUpdateNote, useSoftDeleteNote, useToggleNotePin, useToggleNoteFavorite,
  useToggleNoteVault, useGetVaultStatus, useSetupVault, useUnlockVault,
  getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { SlashCommandExtension, SlashCommandMenu } from "./editor/SlashCommandMenu";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { cn } from "@/lib/utils";
import { VaultModal } from "./VaultModal";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useDemoMode } from "@/lib/demo-context";
import { FindReplaceExtension, FindReplacePanel, frClear } from "./editor/FindReplace";
import { VideoEmbedExtension } from "./editor/VideoEmbed";
import { exportAsPdf, exportAsMarkdown } from "@/hooks/use-note-export";
import { useUploadAttachment, isImageType } from "@/hooks/use-attachments";
import { IMAGE_MIME_TYPES } from "@/lib/attachment-limits";
import { TableOfContents } from "./editor/TableOfContents";
import { SmartTaskItem } from "./editor/SmartTaskItem";
import { SwipeIndentExtension } from "./editor/SwipeIndentExtension";
import { EditorToolbar } from "./editor/EditorToolbar";
import { useAiAction } from "@/hooks/use-ai-action";
import { AiSelectionMenu } from "./editor/AiSelectionMenu";
import { MobileSelectionMenu } from "./editor/MobileSelectionMenu";
import { AiStatusIndicator } from "./editor/AiStatusIndicator";
import { EmptyEditorState } from "./editor/EmptyEditorState";
import { VaultLockScreen } from "./editor/VaultLockScreen";
import { NoteHeader } from "./editor/NoteHeader";
import { NoteBody } from "./editor/NoteBody";
import posthog from "posthog-js";

// AiSelectionMenu → extracted to ./editor/AiSelectionMenu.tsx
// MobileSelectionMenu → extracted to ./editor/MobileSelectionMenu.tsx
// FontPickerDropdown and FontSizeWidget → extracted to ./editor/

export function NoteEditor() {
  // Fix 5: atomic Zustand selectors — each component only re-renders when its own value changes
  const selectedNoteId = useAppStore(s => s.selectedNoteId);
  const selectNote = useAppStore(s => s.selectNote);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const isNoteListOpen = useAppStore(s => s.isNoteListOpen);
  const toggleNoteList = useAppStore(s => s.toggleNoteList);
  const setMobileView = useAppStore(s => s.setMobileView);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);
  const bp = useBreakpoint();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();
  const isDemoRef = useRef(isDemo);
  isDemoRef.current = isDemo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note, isLoading } = useGetNote(selectedNoteId || 0, {
    query: {
      enabled: !!selectedNoteId,
      // In demo mode keep the cache alive but never refetch — the cache is pre-populated by
      // enterDemoMode() and subsequent writes go directly to the cache via setQueryData.
      staleTime: isDemo ? Infinity : 30_000,
      gcTime: isDemo ? Infinity : 5 * 60 * 1000,
    } as any,
  });

  const updateNoteMut = useUpdateNote();
  const softDeleteMut = useSoftDeleteNote();
  const pinMut = useToggleNotePin();
  const favMut = useToggleNoteFavorite();
  const vaultMut = useToggleNoteVault();
  const setupVaultMut = useSetupVault();
  const unlockVaultMut = useUnlockVault();
  const { data: vaultStatus } = useGetVaultStatus();
  const isVaultUnlocked = useAppStore(s => s.isVaultUnlocked);
  const setVaultUnlocked = useAppStore(s => s.setVaultUnlocked);
  const [showVaultSetupModal, setShowVaultSetupModal] = useState(false);
  const [showVaultUnlockModal, setShowVaultUnlockModal] = useState(false);
  const [vaultUnlockError, setVaultUnlockError] = useState("");
  const [demoVaultConfigured, setDemoVaultConfigured] = useState(false);

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showToc, setShowToc] = useState(false)

  // PERF: temporary benchmark — measures time from component mount to editor ready
  const editorInitStart = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const didLogEditorInit = useRef(false);

  // PERF: temporary benchmark — tracks timestamps at each stage of a note switch for breakdown logging
  const perfSwitch = useRef({ queryStartTime: 0, queryEndTime: 0, setContentTime: 0 });

  // Fix 1: stable extensions reference — TipTap v3 compareOptions uses referential equality on
  // the extensions array. A new array literal on every render causes editor.setOptions() on every
  // render. useMemo([]) ensures the same array instance is reused for the lifetime of the component.
  const editorExtensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: false }),
    UnderlineExt,
    TextStyle,
    FontSize,
    Color,
    FontFamily,
    CustomImage,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: "Start writing..." }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
    }),
    TaskList,
    SmartTaskItem.configure({ nested: true }),
    SlashCommandExtension,
    SuperscriptExt,
    SubscriptExt,
    FindReplaceExtension,
    VideoEmbedExtension,
    SwipeIndentExtension,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    // PERF: content intentionally omitted — TipTap v3 calls setOptions() on every render when
    // content changes, firing onUpdate (accidental save) and potentially recreating the editor.
    // Content is set imperatively via editor.commands.setContent() in the useEffect below.
    content: "",
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none",
        // Suppress iPadOS / iOS Safari's password-autofill bar above the
        // soft keyboard. Without this, focusing the contenteditable inside
        // a task list (which contains <input type="checkbox"> nodes) makes
        // iOS treat it like a form field and pop up the AutoFill toolbar.
        autocomplete: "off",
        autocorrect: "off",
        spellcheck: "true",
      },
    },
  });

  const lastVersionTimestamp = useRef<number>(0);

  // PERF: temporary benchmark — track isLoading transitions to measure query duration
  const prevIsLoading = useRef(false);
  useEffect(() => {
    if (isLoading && !prevIsLoading.current) {
      perfSwitch.current.queryStartTime = performance.now();
    }
    if (!isLoading && prevIsLoading.current) {
      perfSwitch.current.queryEndTime = performance.now();
    }
    prevIsLoading.current = isLoading;
  }, [isLoading]);

  const { callAI, aiLoading, aiError, captureSelection } = useAiAction(editor, { isDemo });
  const { upload: uploadAttachment } = useUploadAttachment(selectedNoteId);

  useEffect(() => {
    // PERF: temporary benchmark — log editor init time on first mount
    if (editor && !didLogEditorInit.current) {
      didLogEditorInit.current = true;
      const elapsed = performance.now() - editorInitStart.current;
      console.log(`[perf] editor-init: ${elapsed.toFixed(1)}ms`);
    }

    if (note && editor) {
      setTitle(note.title);
      if (editor.getHTML() !== note.content) {
        // Defer setContent outside React's commit phase — TipTap's ReactNodeViewRenderer
        // calls flushSync when editor.isInitialized, which React 19 forbids inside lifecycle methods.
        // PERF: temporary benchmark — record timestamp immediately before setContent
        perfSwitch.current.setContentTime = performance.now();
        setTimeout(() => {
          if (!editor.isDestroyed) {
            editor.commands.setContent(note.content, { emitUpdate: false });
          }
        }, 0);
      }
      // PERF: temporary benchmark — measure note-switch end-to-end and log breakdown
      requestAnimationFrame(() => {
        try {
          const measure = performance.measure("note-switch", "note-switch-start");
          const total = measure.duration;
          const p = perfSwitch.current;
          const clickEntries = performance.getEntriesByName("note-switch-start");
          const clickTime = clickEntries.length > 0 ? clickEntries[clickEntries.length - 1].startTime : 0;
          const clickToQueryStart = clickTime > 0 && p.queryStartTime > 0 ? p.queryStartTime - clickTime : null;
          const queryDuration = p.queryStartTime > 0 && p.queryEndTime > 0 ? p.queryEndTime - p.queryStartTime : null;
          const queryToSetContent = p.queryEndTime > 0 && p.setContentTime > 0 ? p.setContentTime - p.queryEndTime : null;
          const setContentToRendered = p.setContentTime > 0 ? performance.now() - p.setContentTime : null;
          console.log(`[perf] note-switch (note ${note.id}): ${total.toFixed(1)}ms total`, {
            clickToQueryStart: clickToQueryStart !== null ? `${clickToQueryStart.toFixed(1)}ms` : "(cache hit — no fetch)",
            queryDuration: queryDuration !== null ? `${queryDuration.toFixed(1)}ms` : "(cache hit — no fetch)",
            queryToSetContent: queryToSetContent !== null ? `${queryToSetContent.toFixed(1)}ms` : "n/a",
            setContentToRendered: setContentToRendered !== null ? `${setContentToRendered.toFixed(1)}ms` : "n/a",
          });
        } catch {
          // mark may not exist if note was loaded without a click (e.g. initial load)
        }
      });
    } else if (editor && !note) {
      // Note is still loading — clear stale content from previous note
      editor.commands.setContent("", { emitUpdate: false });
      setTitle("");
    }
    setShowVersionHistory(false);
  }, [note?.id, selectedNoteId, editor]);

  // Clipboard paste: intercept image blobs and upload them
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (!editor?.isFocused) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find(item => IMAGE_MIME_TYPES.has(item.type));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      const record = await uploadAttachment(file);
      if (record?.url) {
        editor.chain().focus().setImage({ src: record.url, alt: file.name }).run();
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [editor, uploadAttachment]);

  // Find/replace keyboard shortcut — only intercept when editor has focus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editor?.isFocused) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "f" || key === "h") {
        e.preventDefault();
        setShowFindReplace(true);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [editor]);

  const debouncedSave = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      return (id: number, data: any) => {
        setSaveStatus("saving");
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          if (isDemoRef.current) {
            // Demo mode: update the React Query cache directly (ephemeral, resets on refresh)
            const existing = queryClient.getQueryData(getGetNoteQueryKey(id)) as any;
            if (existing) {
              queryClient.setQueryData(getGetNoteQueryKey(id), {
                ...existing,
                ...data,
                updatedAt: new Date().toISOString(),
              });
            }
          } else {
            await updateNoteMut.mutateAsync({ id, data });
            queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
            // Fire-and-forget version snapshot — client-side 5-min guard to skip redundant requests
            const now = Date.now();
            if (now - lastVersionTimestamp.current >= 5 * 60 * 1000) {
              authenticatedFetch(`/api/notes/${id}/versions`, { method: "POST" })
                .then(() => { lastVersionTimestamp.current = Date.now(); })
                .catch(() => {});
            }
          }
          setSaveStatus("saved");
        }, 800);
      };
    })(),
    []
  );

  // Fix 5: useCallback on handlers passed to memoized children to prevent needless re-renders
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedNoteId) debouncedSave(selectedNoteId, { title: newTitle });
  }, [selectedNoteId, debouncedSave]);

  const handleContentChange = (html: string, text: string) => {
    if (selectedNoteId) debouncedSave(selectedNoteId, { content: html, contentText: text });
  };

  // Remove the editor image node whose src contains the given storage path.
  // Called after an image attachment is deleted so the live editor reflects the change
  // immediately (in addition to the note query invalidation that follows from the mutation).
  const handleDeleteImage = useCallback((storagePath: string) => {
    if (!editor) return;
    const { state, view } = editor;
    const positions: Array<{ from: number; to: number }> = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === "image" && (node.attrs.src as string)?.includes(storagePath)) {
        positions.push({ from: pos, to: pos + node.nodeSize });
      }
    });
    if (!positions.length) return;
    let tr = state.tr;
    // Delete in reverse order so positions remain valid
    for (let i = positions.length - 1; i >= 0; i--) {
      tr = tr.delete(positions[i].from, positions[i].to);
    }
    view.dispatch(tr);
  }, [editor]);

  const handleRestoreVersion = useCallback((content: string, restoredTitle: string) => {
    if (!editor || !selectedNoteId) return;
    editor.commands.setContent(content, { emitUpdate: false });
    setTitle(restoredTitle);
    debouncedSave(selectedNoteId, { content, title: restoredTitle, contentText: editor.getText() });
    posthog.capture("version_history_restored", { note_id: selectedNoteId });
  }, [editor, selectedNoteId, debouncedSave]);

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (isDemo) {
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) {
        const now = new Date().toISOString();
        const autoDeleteAt = new Date(Date.now() + 30 * 86400000).toISOString();
        queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), {
          ...existing,
          _demoDeleted: true,
          deletedAt: now,
          autoDeleteAt,
          deletedReason: "deleted",
        });
      }
      selectNote(null);
      if (bp !== "desktop") setMobileView("list");
      return;
    }
    await softDeleteMut.mutateAsync({ id: selectedNoteId });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    selectNote(null);
    if (bp !== "desktop") setMobileView("list");
  };

  // Fix 3: optimistic update for pin/fav — updates cache immediately so the UI feels instant
  const handleAction = useCallback((action: "pin" | "fav") => {
    if (!selectedNoteId || !note) return;
    if (isDemo) {
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) {
        queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), {
          ...existing,
          ...(action === "pin" ? { pinned: !existing.pinned } : { favorite: !existing.favorite }),
        });
      }
      return;
    }
    const id = selectedNoteId;
    const field = action === "pin" ? "pinned" : "favorite";
    const newVal = action === "pin" ? !note.pinned : !note.favorite;
    if (action === "pin") posthog.capture("note_pinned", { note_id: id, pinned: newVal });
    if (action === "fav") posthog.capture("note_favorited", { note_id: id, favorited: newVal });
    const mutOpts = {
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: getGetNoteQueryKey(id) });
        const prev = queryClient.getQueryData(getGetNoteQueryKey(id));
        queryClient.setQueryData(getGetNoteQueryKey(id), (old: any) => old ? { ...old, [field]: newVal } : old);
        // Also patch every cached notes-list variant so the sidebar icon updates instantly
        queryClient.setQueriesData({ queryKey: getGetNotesQueryKey() }, (old: any) =>
          Array.isArray(old) ? old.map((n: any) => n.id === id ? { ...n, [field]: newVal } : n) : old
        );
        return { prev };
      },
      onError: (_e: unknown, _v: unknown, ctx: any) => {
        queryClient.setQueryData(getGetNoteQueryKey(id), ctx?.prev);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      },
    };
    if (action === "pin") pinMut.mutate({ id }, mutOpts);
    if (action === "fav") favMut.mutate({ id }, mutOpts);
  }, [selectedNoteId, note, isDemo, queryClient, pinMut, favMut]);

  const handleToggleVault = async () => {
    if (!selectedNoteId || !note) return;
    // If moving TO vault and no PIN is set, prompt setup first (both demo and real)
    if (!note.vaulted) {
      const pinConfigured = isDemo ? demoVaultConfigured : vaultStatus?.isConfigured;
      if (!pinConfigured) {
        setShowVaultSetupModal(true);
        return;
      }
    }
    if (isDemo) {
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...existing, vaulted: !note.vaulted });
      return;
    }
    // Fix 3: optimistic vault toggle — assign opts to a variable to bypass TS excess property check
    const id = selectedNoteId;
    const newVaulted = !note.vaulted;
    posthog.capture("note_vaulted", { note_id: id, vaulted: newVaulted });
    const vaultMutOpts = {
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: getGetNoteQueryKey(id) });
        const prev = queryClient.getQueryData(getGetNoteQueryKey(id));
        queryClient.setQueryData(getGetNoteQueryKey(id), (old: any) => old ? { ...old, vaulted: newVaulted } : old);
        return { prev };
      },
      onError: (_e: unknown, _v: unknown, ctx: any) => {
        queryClient.setQueryData(getGetNoteQueryKey(id), ctx?.prev);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      },
    };
    vaultMut.mutate({ id, data: { vaulted: newVaulted } }, vaultMutOpts);
  };

  const handleExportPdf = useCallback(() => {
    posthog.capture("note_exported", { format: "pdf" });
    exportAsPdf(title, editor?.getHTML() ?? note?.content ?? "");
  }, [title, editor, note?.content]);
  const handleExportMarkdown = useCallback(() => {
    posthog.capture("note_exported", { format: "markdown" });
    exportAsMarkdown(title, editor?.getHTML() ?? note?.content ?? "");
  }, [title, editor, note?.content]);

  const handleVaultSetupConfirm = async (hash: string) => {
    if (!selectedNoteId || !note) return;
    setShowVaultSetupModal(false);
    if (isDemo) {
      setDemoVaultConfigured(true);
      sessionStorage.setItem("demo_vault_hash", hash);
      queryClient.setQueryData(["/api/vault/status"], { isConfigured: true });
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...existing, vaulted: true });
      return;
    }
    await setupVaultMut.mutateAsync({ data: { passwordHash: hash } });
    await vaultMut.mutateAsync({ id: selectedNoteId, data: { vaulted: true } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleUnlockConfirm = async (hash: string) => {
    setVaultUnlockError("");
    if (isDemo) {
      const stored = sessionStorage.getItem("demo_vault_hash");
      if (!stored || stored === hash) {
        setShowVaultUnlockModal(false);
        setVaultUnlocked(true);
      } else {
        setVaultUnlockError("Wrong PIN.");
      }
      return;
    }
    setShowVaultUnlockModal(false);
    await unlockVaultMut.mutateAsync({ data: { passwordHash: hash } });
    setVaultUnlocked(true);
  };

  // Tags
  const addTag = useCallback(async (tag: string) => {
    if (!selectedNoteId || !note) return;
    const newTags = [...(note.tags ?? []), tag];
    if (isDemo) {
      queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...note, tags: newTags });
      return;
    }
    await updateNoteMut.mutateAsync({ id: selectedNoteId, data: { tags: newTags } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
  }, [selectedNoteId, note, isDemo, queryClient, updateNoteMut]);

  const removeTag = useCallback(async (tag: string) => {
    if (!selectedNoteId || !note) return;
    const newTags = (note.tags ?? []).filter(t => t !== tag);
    if (isDemo) {
      queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...note, tags: newTags });
      return;
    }
    await updateNoteMut.mutateAsync({ id: selectedNoteId, data: { tags: newTags } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
  }, [selectedNoteId, note, isDemo, queryClient, updateNoteMut]);

  const handleBack = useCallback(() => {
    setMobileView("list");
    selectNote(null);
  }, [setMobileView, selectNote]);

  // Stable pin/fav wrappers for NoteHeader to avoid inline arrow re-allocation
  const handlePin = useCallback(() => handleAction("pin"), [handleAction]);
  const handleFav = useCallback(() => handleAction("fav"), [handleAction]);

  if (!selectedNoteId) {
    if (bp === "mobile") return null;
    return (
      <EmptyEditorState
        bp={bp}
        isSidebarOpen={isSidebarOpen}
        isNoteListOpen={isNoteListOpen}
        onToggleSidebar={toggleSidebar}
        onToggleNoteList={toggleNoteList}
      />
    );
  }

  if (isLoading || !editor) {
    return <div className="flex-1 flex items-center justify-center bg-editor"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (note?.vaulted && !isVaultUnlocked) {
    return (
      <VaultLockScreen
        bp={bp}
        isSidebarOpen={isSidebarOpen}
        isNoteListOpen={isNoteListOpen}
        onToggleSidebar={toggleSidebar}
        onToggleNoteList={toggleNoteList}
        onBack={handleBack}
        showVaultUnlockModal={showVaultUnlockModal}
        onRequestUnlock={() => setShowVaultUnlockModal(true)}
        onUnlockConfirm={handleUnlockConfirm}
        onUnlockCancel={() => { setShowVaultUnlockModal(false); setVaultUnlockError(""); }}
        vaultUnlockError={vaultUnlockError}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-editor h-screen overflow-hidden relative">
      <NoteHeader
        bp={bp}
        note={note}
        saveStatus={saveStatus}
        isSidebarOpen={isSidebarOpen}
        isNoteListOpen={isNoteListOpen}
        editor={editor}
        showToc={showToc}
        showVersionHistory={showVersionHistory}
        onToggleSidebar={toggleSidebar}
        onToggleNoteList={toggleNoteList}
        onBack={handleBack}
        onPin={handlePin}
        onFav={handleFav}
        onVaultToggle={handleToggleVault}
        onVersionHistory={() => setShowVersionHistory(v => !v)}
        onSetShowToc={setShowToc}
        onExportPdf={handleExportPdf}
        onExportMarkdown={handleExportMarkdown}
        onDelete={handleDelete}
      />

      {/* Toolbar — desktop/tablet: below header; mobile: at bottom */}
      {bp !== "mobile" && (
        <EditorToolbar
          editor={editor}
          showUndoRedo
          onAttachFile={async (file) => {
            const record = await uploadAttachment(file);
            if (record?.url && isImageType(file.type)) {
              editor.chain().focus().setImage({ src: record.url, alt: file.name }).run();
            }
          }}
        />
      )}

      {/* Text selection menus */}
      {bp === "mobile" ? (
        <MobileSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={captureSelection}
        />
      ) : (
        <AiSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={captureSelection}
        />
      )}

      <AiStatusIndicator aiLoading={aiLoading} aiError={aiError} />

      <NoteBody
        editor={editor}
        title={title}
        note={note}
        noteId={selectedNoteId}
        bp={bp}
        keyboardHeight={keyboardHeight}
        onTitleChange={handleTitleChange}
        onAddTag={addTag}
        onRemoveTag={removeTag}
        onDeleteImage={handleDeleteImage}
      />

      {/* Slash command floating menu */}
      <SlashCommandMenu editor={editor} />

      {/* Version History Panel */}
      {showVersionHistory && selectedNoteId && (
        <VersionHistoryPanel
          noteId={selectedNoteId}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      <TableOfContents
        editor={editor}
        isOpen={showToc}
        onClose={() => setShowToc(false)}
      />

      {/* Mobile bottom toolbar — keyboard-aware */}
      {bp === "mobile" && (
        <EditorToolbar
          editor={editor}
          className="fixed left-0 right-0 z-40 border-t border-panel-border bg-editor/95 backdrop-blur-md"
          style={{ bottom: keyboardHeight > 0 ? keyboardHeight : 0 }}
          onAttachFile={async (file) => {
            const record = await uploadAttachment(file);
            if (record?.url && isImageType(file.type)) {
              editor.chain().focus().setImage({ src: record.url, alt: file.name }).run();
            }
          }}
        />
      )}

      {showFindReplace && editor && (
        <FindReplacePanel
          editor={editor}
          onClose={() => {
            setShowFindReplace(false);
            frClear(editor);
          }}
        />
      )}

      {showVaultSetupModal && (
        <VaultModal
          mode="setup"
          onConfirm={handleVaultSetupConfirm}
          onCancel={() => setShowVaultSetupModal(false)}
        />
      )}

    </div>
  );
}

// EditorToolbar, OverflowMenu, ExportMenu → extracted to ./editor/

