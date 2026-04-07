// NoteShell — wrapper around GrapheEditor for full notes.
// Contains the note header, save logic, title/tag state, version history, vault state,
// and all note-specific orchestration. The actual TipTap editor lives in GrapheEditor.

import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/react";

import { useAppStore } from "@/store";
import {
  useGetNote, useUpdateNote, useSoftDeleteNote, useToggleNotePin, useToggleNoteFavorite,
  useToggleNoteVault, useGetVaultStatus, useSetupVault, useUnlockVault,
  getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { VaultModal } from "./VaultModal";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useDemoMode } from "@/lib/demo-context";
import { exportAsPdf, exportAsMarkdown } from "@/hooks/use-note-export";
import { useUploadAttachment } from "@/hooks/use-attachments";
import { TableOfContents } from "./editor/TableOfContents";
import { NoteHeader } from "./editor/NoteHeader";
import { NoteBody } from "./editor/NoteBody";
import { EmptyEditorState } from "./editor/EmptyEditorState";
import { VaultLockScreen } from "./editor/VaultLockScreen";
import { GrapheEditor } from "./editor/GrapheEditor";
import posthog from "posthog-js";

export function NoteShell() {
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
  const [showToc, setShowToc] = useState(false);

  // Editor instance — set via GrapheEditor's onEditorReady callback
  const [editor, setEditor] = useState<Editor | null>(null);

  // PERF: temporary benchmark timestamps
  const editorInitStart = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const didLogEditorInit = useRef(false);
  const lastVersionTimestamp = useRef<number>(0);
  const perfSwitch = useRef({ queryStartTime: 0, queryEndTime: 0, setContentTime: 0 });
  const prevIsLoading = useRef(false);

  // PERF: track isLoading transitions to measure query duration
  useEffect(() => {
    if (isLoading && !prevIsLoading.current) {
      perfSwitch.current.queryStartTime = performance.now();
    }
    if (!isLoading && prevIsLoading.current) {
      perfSwitch.current.queryEndTime = performance.now();
    }
    prevIsLoading.current = isLoading;
  }, [isLoading]);

  // Sync note metadata (title, version history reset) when the note changes
  useEffect(() => {
    if (editor && !didLogEditorInit.current) {
      didLogEditorInit.current = true;
      const elapsed = performance.now() - editorInitStart.current;
      console.log(`[perf] editor-init: ${elapsed.toFixed(1)}ms`);
    }

    if (note) {
      setTitle(note.title);
      // PERF: log note-switch breakdown
      perfSwitch.current.setContentTime = performance.now();
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
    } else {
      setTitle("");
    }
    setShowVersionHistory(false);
  }, [note?.id, selectedNoteId, editor]);

  const { upload: uploadAttachment } = useUploadAttachment(selectedNoteId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debouncedSave = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (id: number, data: any) => {
        setSaveStatus("saving");
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          if (isDemoRef.current) {
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

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedNoteId) debouncedSave(selectedNoteId, { title: newTitle });
  }, [selectedNoteId, debouncedSave]);

  const handleContentChange = useCallback((html: string, text: string) => {
    if (selectedNoteId) debouncedSave(selectedNoteId, { content: html, contentText: text });
  }, [selectedNoteId, debouncedSave]);

  // Remove the editor image node whose src contains the given storage path.
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Optimistic update for pin/fav
  const handleAction = useCallback((action: "pin" | "fav") => {
    if (!selectedNoteId || !note) return;
    if (isDemo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueryData(getGetNoteQueryKey(id), (old: any) => old ? { ...old, [field]: newVal } : old);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueriesData({ queryKey: getGetNotesQueryKey() }, (old: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Array.isArray(old) ? old.map((n: any) => n.id === id ? { ...n, [field]: newVal } : n) : old
        );
        return { prev };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!note.vaulted) {
      const pinConfigured = isDemo ? demoVaultConfigured : vaultStatus?.isConfigured;
      if (!pinConfigured) {
        setShowVaultSetupModal(true);
        return;
      }
      if (!isVaultUnlocked) {
        setVaultUnlockError("");
        setShowVaultUnlockModal(true);
        return;
      }
    }
    if (isDemo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...existing, vaulted: !note.vaulted });
      return;
    }
    const id = selectedNoteId;
    const newVaulted = !note.vaulted;
    posthog.capture("note_vaulted", { note_id: id, vaulted: newVaulted });
    const vaultMutOpts = {
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: getGetNoteQueryKey(id) });
        const prev = queryClient.getQueryData(getGetNoteQueryKey(id));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        queryClient.setQueryData(getGetNoteQueryKey(id), (old: any) => old ? { ...old, vaulted: newVaulted } : old);
        return { prev };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const handlePin = useCallback(() => handleAction("pin"), [handleAction]);
  const handleFav = useCallback(() => handleAction("fav"), [handleAction]);

  // Attach file: upload via shell, return result for GrapheEditor to insert image.
  // uploadAttachment returns AttachmentRecord | null; normalise to match the prop signature.
  const handleAttachFile = useCallback(async (file: File): Promise<{ url?: string } | undefined> => {
    const result = await uploadAttachment(file);
    if (!result) return undefined;
    return { url: result.url ?? undefined };
  }, [uploadAttachment]);

  // ── Empty state ──────────────────────────────────────────────────────────────

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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
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

      <GrapheEditor
        content={note?.content ?? ""}
        contentKey={note?.id}
        onContentChange={handleContentChange}
        mode="note"
        isDemo={isDemo}
        onAttachFile={handleAttachFile}
        onEditorReady={setEditor}
        renderContent={(ed) => (
          <NoteBody
            editor={ed}
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
        )}
      />

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

      {showVaultSetupModal && (
        <VaultModal
          mode="setup"
          onConfirm={handleVaultSetupConfirm}
          onCancel={() => setShowVaultSetupModal(false)}
        />
      )}

      {showVaultUnlockModal && (
        <VaultModal
          mode="unlock"
          error={vaultUnlockError}
          onConfirm={handleUnlockConfirm}
          onCancel={() => { setShowVaultUnlockModal(false); setVaultUnlockError(""); }}
        />
      )}
    </div>
  );
}
