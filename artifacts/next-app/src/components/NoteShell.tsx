// NoteShell — wrapper around GrapheEditor for full notes.
// Contains the note header, save logic, title/tag state, version history, vault state,
// and all note-specific orchestration. The actual TipTap editor lives in GrapheEditor.

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Sentry from "@sentry/nextjs";
import { useAnimationConfig } from "@/hooks/use-motion";
import type { Editor } from "@tiptap/react";

import { useAppStore } from "@/store";
import {
  useGetNote, useUpdateNote, useSoftDeleteNote, useToggleNotePin, useToggleNoteFavorite,
  useToggleNoteVault, useGetVaultStatus, useSetupVault, useUnlockVault,
  getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { VersionPreviewArea } from "./VersionPreviewArea";
import { VaultModal } from "./VaultModal";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { useCreateNoteVersion, type NoteVersionFull } from "@/hooks/use-note-versions";
import { useDemoMode } from "@/lib/demo-context";
import { exportAsPdf, exportAsMarkdown } from "@/hooks/use-note-export";
import { useUploadAttachment } from "@/hooks/use-attachments";
import { cn } from "@/lib/utils";
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
  const setNoteListOpen = useAppStore(s => s.setNoteListOpen);
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
  const [previewVersion, setPreviewVersion] = useState<NoteVersionFull | null>(null);
  // Snapshot the sidebar/note-list visibility right before we collapse them
  // for the version history panel, so we can restore the user's previous
  // layout when the panel closes. Null means "no snapshot held".
  const prevSidebarOpenRef = useRef<boolean | null>(null);
  const prevNoteListOpenRef = useRef<boolean | null>(null);

  // Editor instance — set via GrapheEditor's onEditorReady callback
  const [editor, setEditor] = useState<Editor | null>(null);

  const createVersion = useCreateNoteVersion();

  // ── View transition animations ──────────────────────────────────────────────
  const anim = useAnimationConfig();
  const animRef = useRef(anim);
  animRef.current = anim;
  const contentControls = useAnimation();
  // undefined = first render (skip anim), null = no note selected, number = note ID
  const prevNoteIdForAnim = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const prevId = prevNoteIdForAnim.current;
    prevNoteIdForAnim.current = selectedNoteId;

    if (prevId === undefined) {
      // First render — snap to fully visible, no animation
      contentControls.set({ opacity: 1, y: 0 });
      return;
    }
    if (!selectedNoteId) return;

    const isNewNoteEntrance = prevId === null;
    const a = animRef.current;

    const runAnim = async () => {
      if (isNewNoteEntrance) {
        // New note presented: slide up from below
        contentControls.set({ opacity: 0, y: a.level === "full" ? 12 : 0 });
        await contentControls.start({
          opacity: 1,
          y: 0,
          transition: a.standardTransition,
        });
      } else {
        // Note switch crossfade: fade out then fade in with subtle lift
        await contentControls.start({
          opacity: 0,
          y: a.level === "full" ? 4 : 0,
          transition: { duration: 0.1, ease: "easeOut" as const },
        });
        contentControls.set({ y: 0 });
        await contentControls.start({
          opacity: 1,
          y: 0,
          transition: a.level === "minimal"
            ? { duration: 0.1, ease: "linear" as const }
            : a.fastTransition,
        });
      }
    };

    try {
      runAnim();
    } catch (err) {
      Sentry.captureException(err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  // ── PostHog-wrapped panel toggle callbacks ──────────────────────────────────
  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
    try {
      posthog.capture("panel_toggled", {
        panel: "sidebar",
        action: isSidebarOpen ? "close" : "open",
        timestamp: new Date().toISOString(),
      });
    } catch { /* PostHog may not be initialized */ }
  }, [toggleSidebar, isSidebarOpen]);

  const handleToggleNoteList = useCallback(() => {
    toggleNoteList();
    try {
      posthog.capture("panel_toggled", {
        panel: "note_list",
        action: isNoteListOpen ? "close" : "open",
        timestamp: new Date().toISOString(),
      });
    } catch { /* PostHog may not be initialized */ }
  }, [toggleNoteList, isNoteListOpen]);

  // Refs holding the live editor state — used by performSave so we always
  // snapshot what's currently in the editor, not a stale closure value.
  const liveStateRef = useRef<{ title: string; content: string; contentText: string }>(
    { title: "", content: "", contentText: "" },
  );
  // Pending save buffer + timer. The debounced save merges multiple change
  // events into a single payload and fires after 800ms. flushSave() uses these
  // to commit immediately on Cmd+S or note close.
  const pendingSaveRef = useRef<{ id: number; data: Record<string, unknown> } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the previous selected note id so we can flush on navigation.
  const prevSelectedNoteId = useRef<number | null>(null);
  // Stable handle for flushSave so it can be called from effects that fire
  // before flushSave is declared in render order.
  const flushSaveRef = useRef<
    (source: "manual_save" | "auto_close" | "restore") => Promise<boolean>
  >(async () => false);

  // PERF: temporary benchmark timestamps
  const editorInitStart = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);
  const didLogEditorInit = useRef(false);
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
      posthog.capture("editor_opened", { timestamp: new Date().toISOString() });
    }

    // Flush any pending save from the previous note before we swap to the new
    // one — capture an "auto_close" snapshot if there are unsaved changes.
    if (
      prevSelectedNoteId.current != null &&
      prevSelectedNoteId.current !== selectedNoteId &&
      pendingSaveRef.current
    ) {
      void flushSaveRef.current("auto_close");
    }
    prevSelectedNoteId.current = selectedNoteId;

    if (note) {
      setTitle(note.title);
      // Seed the live state so the next save reflects the freshly-loaded note.
      liveStateRef.current = {
        title: note.title,
        content: note.content ?? "",
        contentText: note.contentText ?? "",
      };
      setPreviewVersion(null);
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

  // When the version history panel opens on tablet/desktop, collapse the
  // sidebar and note list so the editor + history can claim the full width.
  // The previous open-state is restored when the panel closes. Mobile is
  // unaffected because there are no docked side panels at that breakpoint.
  useEffect(() => {
    if (bp === "mobile") return;
    if (showVersionHistory) {
      if (prevSidebarOpenRef.current === null) {
        prevSidebarOpenRef.current = isSidebarOpen;
        prevNoteListOpenRef.current = isNoteListOpen;
        if (isSidebarOpen) setSidebarOpen(false);
        if (isNoteListOpen) setNoteListOpen(false);
      }
    } else if (prevSidebarOpenRef.current !== null) {
      const restoreSidebar = prevSidebarOpenRef.current;
      const restoreNoteList = prevNoteListOpenRef.current ?? true;
      prevSidebarOpenRef.current = null;
      prevNoteListOpenRef.current = null;
      setSidebarOpen(restoreSidebar);
      setNoteListOpen(restoreNoteList);
    }
    // We intentionally exclude isSidebarOpen / isNoteListOpen from deps so
    // that the user can still manually toggle the panels while history is
    // open without re-triggering the snapshot/restore logic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVersionHistory, bp]);

  const { upload: uploadAttachment } = useUploadAttachment(selectedNoteId);

  // ─── Save pipeline ────────────────────────────────────────────────────────
  // performSave commits the current pending payload to the server (or the
  // demo cache) and then takes a version snapshot tagged with `source`.
  // Auto-save snapshots are gated by the change threshold inside
  // useCreateNoteVersion so trivial keystrokes don't accumulate versions.

  const performSave = useCallback(
    async (
      id: number,
      data: Record<string, unknown>,
      source:
        | "manual_save"
        | "auto_save"
        | "auto_close"
        | "restore"
        | "pre_ai_rewrite",
    ) => {
      const live = liveStateRef.current;
      if (isDemoRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing = queryClient.getQueryData(getGetNoteQueryKey(id)) as any;
        if (existing) {
          queryClient.setQueryData(getGetNoteQueryKey(id), {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateNoteMut.mutateAsync({ id, data: data as any });
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      }
      setSaveStatus("saved");

      // Take the snapshot AFTER the save completes — in real mode the server
      // reads from the DB row we just updated, so the version reflects the
      // current state.
      await createVersion({
        noteId: id,
        source,
        title: live.title,
        content: live.content,
        contentText: live.contentText,
      });
    },
    [queryClient, updateNoteMut, createVersion],
  );

  const debouncedSave = useCallback(
    (id: number, data: Record<string, unknown>) => {
      setSaveStatus("saving");
      pendingSaveRef.current = {
        id,
        data: { ...(pendingSaveRef.current?.data ?? {}), ...data },
      };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        saveTimerRef.current = null;
        if (pending) void performSave(pending.id, pending.data, "auto_save");
      }, 800);
    },
    [performSave],
  );

  // Flush any pending debounced save immediately. Used for Cmd+S, restore,
  // pre-AI snapshot, and note-close auto-snapshot. The pending save is
  // committed AND the resulting snapshot is tagged with `source`. Returns
  // true if a save was actually flushed.
  const flushSave = useCallback(
    async (
      source:
        | "manual_save"
        | "auto_close"
        | "restore"
        | "pre_ai_rewrite",
    ): Promise<boolean> => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (!pending) return false;
      await performSave(pending.id, pending.data, source);
      return true;
    },
    [performSave],
  );

  useEffect(() => {
    flushSaveRef.current = flushSave as (
      source: "manual_save" | "auto_close" | "restore",
    ) => Promise<boolean>;
  }, [flushSave]);

  // Take an explicit snapshot — used by Cmd+S and the AI rewrite pre-snapshot.
  // If there's a pending debounced save, flush it tagged with `source` so the
  // version captures the latest state. Otherwise just snapshot the current
  // editor state directly.
  const captureSnapshot = useCallback(
    async (source: "manual_save" | "pre_ai_rewrite") => {
      if (!selectedNoteId) return;
      const flushed = await flushSave(source);
      if (!flushed) {
        const live = liveStateRef.current;
        await createVersion({
          noteId: selectedNoteId,
          source,
          title: live.title,
          content: live.content,
          contentText: live.contentText,
        });
      }
    },
    [selectedNoteId, flushSave, createVersion],
  );

  // Cmd/Ctrl+S manual save → flush + manual_save version.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "s") return;
      if (!selectedNoteId) return;
      e.preventDefault();
      void captureSnapshot("manual_save");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedNoteId, captureSnapshot]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    liveStateRef.current = { ...liveStateRef.current, title: newTitle };
    if (selectedNoteId) debouncedSave(selectedNoteId, { title: newTitle });
  }, [selectedNoteId, debouncedSave]);

  const handleContentChange = useCallback((html: string, text: string) => {
    liveStateRef.current = { ...liveStateRef.current, content: html, contentText: text };
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

  // Restore is non-destructive: snapshot the current draft as "Before restore"
  // first, then replace the editor content with the version. The user can
  // always undo a restore by restoring the "Before restore" version.
  const handleRestoreVersion = useCallback(
    async (version: NoteVersionFull) => {
      if (!editor || !selectedNoteId) return;
      // 1. Snapshot the current draft as a labelled version so the restore
      //    is reversible. flushSave() merges any pending unsaved changes.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      pendingSaveRef.current = null;
      const live = liveStateRef.current;
      await createVersion({
        noteId: selectedNoteId,
        source: "restore",
        label: "Before restore",
        title: live.title,
        content: live.content,
        contentText: live.contentText,
      });

      // 2. Replace editor content + title with the version's data.
      editor.commands.setContent(version.content, { emitUpdate: false });
      setTitle(version.title);
      const newText = editor.getText();
      liveStateRef.current = {
        title: version.title,
        content: version.content,
        contentText: newText,
      };

      // 3. Persist the restored content as the new note state. We use
      //    performSave directly so the post-restore snapshot is tagged
      //    "restore" rather than auto_save.
      await performSave(
        selectedNoteId,
        {
          title: version.title,
          content: version.content,
          contentText: newText,
        },
        "restore",
      );
      setPreviewVersion(null);
      posthog.capture("version_history_restored", { note_id: selectedNoteId });
    },
    [editor, selectedNoteId, createVersion, performSave],
  );

  // Take a snapshot before any AI rewrite so the user can always undo it.
  const handleBeforeAiRewrite = useCallback(async () => {
    await captureSnapshot("pre_ai_rewrite");
  }, [captureSnapshot]);

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
      posthog.capture("note_deleted", { note_id: selectedNoteId, timestamp: new Date().toISOString() });
      selectNote(null);
      if (bp !== "desktop") setMobileView("list");
      return;
    }
    await softDeleteMut.mutateAsync({ id: selectedNoteId });
    posthog.capture("note_deleted", { note_id: selectedNoteId, timestamp: new Date().toISOString() });
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
    try {
      await setupVaultMut.mutateAsync({ data: { passwordHash: hash } });
      await vaultMut.mutateAsync({ id: selectedNoteId, data: { vaulted: true } });
      queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    } catch {
      // Setup failed — nothing to roll back; the user can try again from the
      // note overflow menu or Settings.
    }
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
    try {
      await unlockVaultMut.mutateAsync({ data: { passwordHash: hash } });
      setShowVaultUnlockModal(false);
      setVaultUnlocked(true);
    } catch {
      // Keep the modal open so the user can try again.
      setVaultUnlockError("Wrong PIN.");
    }
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
        onToggleSidebar={handleToggleSidebar}
        onToggleNoteList={handleToggleNoteList}
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
        onToggleSidebar={handleToggleSidebar}
        onToggleNoteList={handleToggleNoteList}
        onBack={handleBack}
        showVaultUnlockModal={showVaultUnlockModal}
        onRequestUnlock={() => setShowVaultUnlockModal(true)}
        onUnlockConfirm={handleUnlockConfirm}
        onUnlockCancel={() => { setShowVaultUnlockModal(false); setVaultUnlockError(""); }}
        vaultUnlockError={vaultUnlockError}
      />
    );
  }

  // When version history is open on tablet/desktop the panel sits as a fixed
  // 360px column on the right. Reserve that space on the editor wrapper so the
  // note + preview overlay sit beside the panel instead of underneath it.
  const reservePanelSpace =
    showVersionHistory && bp !== "mobile";

  return (
    <div
      className={cn(
        "flex-1 flex flex-col bg-editor h-screen overflow-hidden relative transition-[padding] duration-200",
        reservePanelSpace && "pr-[360px]",
      )}
    >
      <NoteHeader
        bp={bp}
        note={note}
        saveStatus={saveStatus}
        isSidebarOpen={isSidebarOpen}
        isNoteListOpen={isNoteListOpen}
        editor={editor}
        showToc={showToc}
        showVersionHistory={showVersionHistory}
        onToggleSidebar={handleToggleSidebar}
        onToggleNoteList={handleToggleNoteList}
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

      <motion.div
        animate={contentControls}
        initial={{ opacity: 1 }}
        className="relative flex-1 flex flex-col min-h-0"
        data-testid="editor-content-area"
      >
        <GrapheEditor
          content={note?.content ?? ""}
          contentKey={note?.id}
          onContentChange={handleContentChange}
          mode="note"
          isDemo={isDemo}
          onAttachFile={handleAttachFile}
          onEditorReady={setEditor}
          onBeforeAiRewrite={handleBeforeAiRewrite}
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

        {previewVersion && selectedNoteId && bp !== "mobile" && (
          <VersionPreviewArea
            version={previewVersion}
            currentTitle={liveStateRef.current.title}
            currentContent={liveStateRef.current.content}
            currentContentText={liveStateRef.current.contentText}
            onRestore={() => handleRestoreVersion(previewVersion)}
            onBack={() => setPreviewVersion(null)}
            variant="overlay"
            // Tablet shares the editor pane with the 360px panel — use the
            // compact banner so the toggle + Back + Restore buttons don't
            // overflow the narrowed pane.
            compact={bp === "tablet"}
          />
        )}
      </motion.div>

      {showVersionHistory && selectedNoteId && (
        <VersionHistoryPanel
          noteId={selectedNoteId}
          bp={bp}
          previewVersionId={previewVersion?.id ?? null}
          previewVersion={previewVersion}
          currentTitle={liveStateRef.current.title}
          currentContent={liveStateRef.current.content}
          currentContentText={liveStateRef.current.contentText}
          onPreview={(v) => setPreviewVersion(v)}
          onRestoreVersion={handleRestoreVersion}
          onClose={() => {
            setShowVersionHistory(false);
            setPreviewVersion(null);
          }}
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
