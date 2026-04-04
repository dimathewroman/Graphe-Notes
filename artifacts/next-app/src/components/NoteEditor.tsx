import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle, FontSize } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
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
import { TableOfContents } from "./editor/TableOfContents";
import { SmartTaskItem } from "./editor/SmartTaskItem";
import { EditorToolbar } from "./editor/EditorToolbar";
import { AiSelectionMenu } from "./editor/AiSelectionMenu";
import { MobileSelectionMenu } from "./editor/MobileSelectionMenu";
import { AiStatusIndicator } from "./editor/AiStatusIndicator";
import { EmptyEditorState } from "./editor/EmptyEditorState";
import { VaultLockScreen } from "./editor/VaultLockScreen";
import { NoteHeader } from "./editor/NoteHeader";
import { NoteBody } from "./editor/NoteBody";

// AiSelectionMenu → extracted to ./editor/AiSelectionMenu.tsx
// MobileSelectionMenu → extracted to ./editor/MobileSelectionMenu.tsx
// FontPickerDropdown and FontSizeWidget → extracted to ./editor/

export function NoteEditor() {
  const { selectedNoteId, selectNote, isSidebarOpen, toggleSidebar, isNoteListOpen, toggleNoteList, setMobileView, setSidebarOpen, setAiSetupModalOpen, setPendingAiAction } = useAppStore();
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
      staleTime: isDemo ? Infinity : 0,
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
  const { isVaultUnlocked, setVaultUnlocked } = useAppStore();
  const [showVaultSetupModal, setShowVaultSetupModal] = useState(false);
  const [showVaultUnlockModal, setShowVaultUnlockModal] = useState(false);
  const [vaultUnlockError, setVaultUnlockError] = useState("");
  const [demoVaultConfigured, setDemoVaultConfigured] = useState(false);

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showToc, setShowToc] = useState(false)

  // AI bubble menu state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Store the selection range the moment the toolbar appears, before any
  // menu interaction can disturb the editor's active selection.
  const savedAiSelection = useRef<{ from: number; to: number; text: string } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: false }),
      UnderlineExt,
      TextStyle,
      FontSize,
      Color,
      FontFamily,
      Image,
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
    ],
    content: note?.content || "",
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: { class: "prose prose-invert max-w-none focus:outline-none" },
    },
  }, [selectedNoteId]);

  useEffect(() => {
    if (note && editor) {
      setTitle(note.title);
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content, { emitUpdate: false });
      }
    } else if (editor && !note) {
      // Note is still loading — clear stale content from previous note
      editor.commands.setContent("", { emitUpdate: false });
      setTitle("");
    }
    setShowVersionHistory(false);
  }, [note?.id, selectedNoteId, editor]);

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
            // Fire-and-forget version snapshot (server enforces 5-min interval)
            authenticatedFetch(`/api/notes/${id}/versions`, { method: "POST" }).catch(() => {});
          }
          setSaveStatus("saved");
        }, 800);
      };
    })(),
    []
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedNoteId) debouncedSave(selectedNoteId, { title: newTitle });
  };

  const handleContentChange = (html: string, text: string) => {
    if (selectedNoteId) debouncedSave(selectedNoteId, { content: html, contentText: text });
  };

  const handleRestoreVersion = useCallback((content: string, restoredTitle: string) => {
    if (!editor || !selectedNoteId) return;
    editor.commands.setContent(content, { emitUpdate: false });
    setTitle(restoredTitle);
    debouncedSave(selectedNoteId, { content, title: restoredTitle, contentText: editor.getText() });
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

  const handleAction = async (action: "pin" | "fav") => {
    if (!selectedNoteId) return;
    if (isDemo) {
      // Update cache directly for ephemeral pin/fav in demo mode
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) {
        queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), {
          ...existing,
          ...(action === "pin" ? { pinned: !existing.pinned } : { favorite: !existing.favorite }),
        });
      }
      return;
    }
    if (action === "pin") await pinMut.mutateAsync({ id: selectedNoteId });
    if (action === "fav") await favMut.mutateAsync({ id: selectedNoteId });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

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
    await vaultMut.mutateAsync({ id: selectedNoteId, data: { vaulted: !note.vaulted } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleExportPdf = () => exportAsPdf(title, editor?.getHTML() ?? note?.content ?? "");
  const handleExportMarkdown = () => exportAsMarkdown(title, editor?.getHTML() ?? note?.content ?? "");

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
  const addTag = async (tag: string) => {
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
  };

  const removeTag = async (tag: string) => {
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
  };

  // AI writing tools for selected text
  const callAI = async (action: string, customInstruction?: string) => {
    if (!editor) return;

    // Use the selection that was captured when the toolbar first appeared.
    // Falling back to the current editor state handles edge cases where the
    // toolbar fires without a prior capture.
    const sel = savedAiSelection.current ?? (() => {
      const { from, to } = editor.state.selection;
      return { from, to, text: editor.state.doc.textBetween(from, to) };
    })();

    if (!sel.text.trim()) return;

    const taskType = "manual";

    const selected = sel.text;
    const prompts: Record<string, string> = {
      shorter_25: `Make the following text approximately 25% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${selected}`,
      shorter_50: `Make the following text approximately 50% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${selected}`,
      shorter_custom: `Make the following text shorter. Additional instruction: ${customInstruction || ""}. Return only the shortened text, no explanations:\n\n${selected}`,
      longer_25: `Expand the following text by approximately 25% with more detail and context. Return only the expanded text, no explanations:\n\n${selected}`,
      longer_50: `Expand the following text by approximately 50% with more detail and context. Return only the expanded text, no explanations:\n\n${selected}`,
      longer_custom: `Expand the following text. Additional instruction: ${customInstruction || ""}. Return only the expanded text, no explanations:\n\n${selected}`,
      proofread: `Proofread and fix grammar, spelling, and punctuation in the following text. Do not change wording or structure. Return only the corrected text, no explanations:\n\n${selected}`,
      simplify: `Rewrite the following text using shorter sentences and simpler vocabulary. Keep the same length and meaning. Return only the simplified text, no explanations:\n\n${selected}`,
      improve: `Enhance the clarity, flow, and word choice of the following text while preserving its original meaning. Return only the improved text, no explanations:\n\n${selected}`,
      rewrite: `Completely rephrase the following text while preserving its core meaning. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_casual: `Rewrite the following text in a casual tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_professional: `Rewrite the following text in a professional tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_friendly: `Rewrite the following text in a friendly tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_direct: `Rewrite the following text in a direct tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_custom: `Rewrite the following text with the following tone/style: ${customInstruction || ""}. Return only the rewritten text, no explanations:\n\n${selected}`,
      summarize_short: `Summarize the following text in 1-2 sentences. Return only the summary, no explanations:\n\n${selected}`,
      summarize_balanced: `Summarize the following text in a short paragraph. Return only the summary, no explanations:\n\n${selected}`,
      summarize_detailed: `Summarize the following text as detailed bullet points. Return only the bullet-point summary, no explanations:\n\n${selected}`,
      summarize_custom: `Summarize the following text. Additional instruction: ${customInstruction || ""}. Return only the summary, no explanations:\n\n${selected}`,
      extract_action_items: `Extract all action items, tasks, and to-dos from the following text. Return them as a bulleted list. If no action items are found, return "No action items found.", no explanations:\n\n${selected}`,
    };

    const prompt = prompts[action];
    if (!prompt) { setAiLoading(false); return; }

    // Fetch active provider from server; default to graphe_free on any failure
    let provider = "graphe_free";
    if (!isDemo) {
      try {
        const settingsRes = await authenticatedFetch("/api/ai/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json() as {
            activeAiProvider?: string | null;
            hasCompletedAiSetup?: boolean;
          };

          if (!settingsData.hasCompletedAiSetup) {
            // First AI action — show setup modal and queue this action to run after
            const capturedPrompt = prompt;
            const capturedFrom = sel.from;
            const capturedTo = sel.to;
            const capturedTaskType = taskType;
            setPendingAiAction(async (resolvedProvider: string) => {
              setAiLoading(true);
              setAiError(null);
              try {
                const res = await authenticatedFetch("/api/ai/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ provider: resolvedProvider, taskType: capturedTaskType, prompt: capturedPrompt }),
                });
                if (!res.ok) {
                  setAiError("AI request failed. Please try again.");
                  setTimeout(() => setAiError(null), 5000);
                  return;
                }
                const data = await res.json() as { result?: string; error?: string };
                if (data.error) throw new Error(data.error);
                const result = data.result || "";
                if (result && editor) {
                  editor.chain().focus().insertContentAt({ from: capturedFrom, to: capturedTo }, result).run();
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : "AI request failed";
                setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
                setTimeout(() => setAiError(null), 5000);
              } finally {
                setAiLoading(false);
                savedAiSelection.current = null;
              }
            });
            setAiSetupModalOpen(true);
            return;
          }

          if (!settingsData.activeAiProvider) return; // No AI mode — silently cancel
          provider = settingsData.activeAiProvider;
        }
      } catch { /* use default */ }
    }

    setAiLoading(true);
    setAiError(null);

    const doRequest = async (): Promise<Response> => {
      return authenticatedFetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, taskType, prompt }),
      });
    };

    try {
      let res = await doRequest();

      if (res.status === 429) {
        const data = await res.json() as { reason?: string; resetInMs?: number };
        if (data.reason === "rpm_limit") {
          setAiError("AI is busy, retrying...");
          await new Promise((resolve) => setTimeout(resolve, 65000));
          res = await doRequest();
          if (res.status === 429) {
            setAiError("AI is still busy. Please try again in a moment.");
            setTimeout(() => setAiError(null), 5000);
            return;
          }
        } else if (data.reason === "hourly_limit_reached") {
          const resetMins = Math.ceil((data.resetInMs ?? 0) / 60000);
          setAiError(`You've reached your hourly AI limit. Resets in ${resetMins} minutes.`);
          setTimeout(() => setAiError(null), 5000);
          return;
        } else if (data.reason === "monthly_limit_reached") {
          setAiError("Monthly AI limit reached. Add your own API key in Settings for unlimited use.");
          setTimeout(() => setAiError(null), 6000);
          return;
        }
      }

      if (res.status === 400) {
        const data = await res.json() as { error?: string };
        if (data.error === "no_key_configured") {
          setAiError("No API key configured. Please add one in Settings.");
          setTimeout(() => setAiError(null), 5000);
          return;
        }
      }

      if (res.status === 401) {
        setAiError("AI key invalid or missing. Check Settings.");
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      if (res.status === 502) {
        setAiError("AI request failed. Please try again.");
        setTimeout(() => setAiError(null), 5000);
        return;
      }

      const data = await res.json() as { error?: string; result?: string };
      if (data.error) throw new Error(data.error);
      const result: string = data.result || "";
      if (result) {
        // Replace the saved selection range directly in the document.
        editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, result).run();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
      savedAiSelection.current = null;
    }
  };

  const handleBack = () => {
    setMobileView("list");
    selectNote(null);
  };

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
    return <div className="flex-1 flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
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
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden relative">
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
        onPin={() => handleAction("pin")}
        onFav={() => handleAction("fav")}
        onVaultToggle={handleToggleVault}
        onVersionHistory={() => setShowVersionHistory(v => !v)}
        onSetShowToc={setShowToc}
        onExportPdf={handleExportPdf}
        onExportMarkdown={handleExportMarkdown}
        onDelete={handleDelete}
      />

      {/* Toolbar — desktop/tablet: below header; mobile: at bottom */}
      {bp !== "mobile" && (
        <EditorToolbar editor={editor} showUndoRedo />
      )}

      {/* Text selection menus */}
      {bp === "mobile" ? (
        <MobileSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={(from, to, text) => {
            savedAiSelection.current = { from, to, text };
          }}
        />
      ) : (
        <AiSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={(from, to, text) => {
            savedAiSelection.current = { from, to, text };
          }}
        />
      )}

      <AiStatusIndicator aiLoading={aiLoading} aiError={aiError} />

      <NoteBody
        editor={editor}
        title={title}
        note={note}
        bp={bp}
        onTitleChange={handleTitleChange}
        onAddTag={addTag}
        onRemoveTag={removeTag}
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
          className="fixed left-0 right-0 z-40 border-t border-panel-border bg-background/95 backdrop-blur-md"
          style={{ bottom: keyboardHeight > 0 ? keyboardHeight : 0 }}
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

