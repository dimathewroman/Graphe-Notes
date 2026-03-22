import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
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
import TaskItem from "@tiptap/extension-task-item";
import SuperscriptExt from "@tiptap/extension-superscript";
import SubscriptExt from "@tiptap/extension-subscript";

import { useAppStore } from "@/store";
import {
  useGetQuickBit,
  useUpdateQuickBit,
  useDeleteQuickBit,
  useCreateNote,
  getGetQuickBitsQueryKey,
  getGetQuickBitQueryKey,
  getGetNotesQueryKey,
} from "@workspace/api-client-react";
import type { QuickBit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, PanelLeft, PanelLeftClose, Trash2, FileText,
  Clock, Bell, Plus, X, Loader2, Zap, Undo2, Redo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { SlashCommandExtension, SlashCommandMenu } from "./editor/SlashCommandMenu";
import { EditorToolbar, AiSelectionMenu, MobileSelectionMenu } from "./NoteEditor";
import { NotificationCadenceEditor } from "./NotificationCadenceEditor";
import { useDemoMode } from "@/App";
import { DEMO_QUICK_BITS } from "@/lib/demo-data";

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function formatExpiry(expiresAt: string | Date): { label: string; className: string } {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  const totalMinutes = msLeft / (1000 * 60);
  const totalHours = msLeft / (1000 * 60 * 60);
  if (msLeft <= 0) return { label: "Expired", className: "text-red-500 font-medium" };
  if (totalHours < 1) {
    const m = Math.ceil(totalMinutes);
    return { label: `${m} minute${m !== 1 ? "s" : ""} left`, className: "text-red-500 font-medium" };
  }
  if (totalHours < 24) {
    const h = Math.ceil(totalHours);
    return { label: `${h} hour${h !== 1 ? "s" : ""} left`, className: "text-red-500 font-medium" };
  }
  const d = Math.ceil(totalHours / 24);
  const className = totalHours < 48 ? "text-amber-500" : "text-muted-foreground/70";
  return { label: `${d} day${d !== 1 ? "s" : ""} left`, className };
}

const EXPIRY_PRESETS = [
  { label: "1 day", days: 1 },
  { label: "2 days", days: 2 },
  { label: "3 days", days: 3 },
  { label: "5 days", days: 5 },
  { label: "7 days", days: 7 },
];

// ─── Expiry Picker (portaled) ─────────────────────────────────────────────────

function ExpiryPicker({
  anchorRef,
  onSelect,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDays, setCustomDays] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuW = 200;
    const menuH = 240;
    const pad = 8;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
    if (left < pad) left = pad;
    if (top + menuH > window.innerHeight - pad) top = rect.top - menuH - 4;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const selectPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    onSelect(d.toISOString());
  };

  const saveCustom = () => {
    const n = parseInt(customDays, 10);
    if (!n || n <= 0) return;
    selectPreset(n);
  };

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left, width: 200 }}
      className="fixed z-50 bg-panel border border-panel-border rounded-xl shadow-xl overflow-hidden"
    >
      {!showCustom ? (
        <div className="py-1">
          {EXPIRY_PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => selectPreset(p.days)}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-panel-hover transition-colors"
            >
              {p.label}
            </button>
          ))}
          <div className="mx-2 my-1 border-t border-panel-border" />
          <button
            onClick={() => setShowCustom(true)}
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-panel-hover hover:text-foreground transition-colors"
          >
            Custom…
          </button>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Days from now</p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="number"
              min={1}
              value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveCustom(); }}
              placeholder="e.g. 10"
              className="w-full px-2 py-1.5 text-sm bg-background border border-panel-border rounded-lg outline-none focus:border-primary text-foreground"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveCustom}
              disabled={!customDays || parseInt(customDays) <= 0}
              className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setShowCustom(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── Notification Popover (portaled) ─────────────────────────────────────────

function NotificationPopover({
  anchorRef,
  value,
  onChange,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  value: number[];
  onChange: (hours: number[]) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuW = 280;
    const menuH = 300;
    const pad = 8;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + menuW > window.innerWidth - pad) left = window.innerWidth - menuW - pad;
    if (left < pad) left = pad;
    if (top + menuH > window.innerHeight - pad) top = rect.top - menuH - 4;
    setPos({ top, left });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      style={{ top: pos.top, left: pos.left, width: 280 }}
      className="fixed z-50 bg-panel border border-panel-border rounded-xl shadow-xl p-3"
    >
      <p className="text-xs font-medium text-muted-foreground mb-2">Notification reminders</p>
      <NotificationCadenceEditor value={value} onChange={onChange} />
    </div>,
    document.body
  );
}

// ─── Expired modal (mobile) ───────────────────────────────────────────────────

function ExpiredModal({
  onExtend,
  onPromote,
  onDelete,
}: {
  onExtend: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-panel border border-panel-border rounded-2xl shadow-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-foreground">This Quick Bit has expired</h3>
        </div>
        <p className="text-sm text-muted-foreground">It will be permanently deleted if you exit.</p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onExtend}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
          >
            Extend expiration
          </button>
          <button
            onClick={onPromote}
            className="w-full py-2.5 rounded-xl bg-panel border border-panel-border text-sm font-medium text-foreground hover:bg-panel-hover transition-colors"
          >
            Promote to Note
          </button>
          <button
            onClick={onDelete}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            Delete and exit
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── QuickBitEditor ───────────────────────────────────────────────────────────

export function QuickBitEditor() {
  const {
    selectedQuickBitId,
    selectQuickBit,
    isSidebarOpen,
    toggleSidebar,
    isNoteListOpen,
    toggleNoteList,
    setMobileView,
    setFilter,
    selectNote,
  } = useAppStore();
  const bp = useBreakpoint();
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();

  const demoQb = isDemo ? DEMO_QUICK_BITS.find((qb) => qb.id === selectedQuickBitId) : undefined;
  const { data: quickBit, isLoading } = useGetQuickBit(selectedQuickBitId || 0, {
    query: {
      enabled: !!selectedQuickBitId,
      queryKey: getGetQuickBitQueryKey(selectedQuickBitId || 0),
      ...(demoQb ? { initialData: demoQb, staleTime: Infinity } : {}),
    },
  });

  const updateMut = useUpdateQuickBit();
  const deleteMut = useDeleteQuickBit();
  const createNoteMut = useCreateNote();

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  // Expiry state
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // forces re-render every minute
  const [expiryPickerOpen, setExpiryPickerOpen] = useState(false);
  const expiryBtnRef = useRef<HTMLButtonElement>(null);
  const expiredWhileEditing = useRef(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // Notifications state
  const [notificationHours, setNotificationHours] = useState<number[]>([]);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const savedAiSelection = useRef<{ from: number; to: number; text: string } | null>(null);

  // Link popover
  const [linkPopover, setLinkPopover] = useState<{ visible: boolean; url: string }>({ visible: false, url: "" });
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!linkPopover.visible) return;
    const handle = (e: MouseEvent) => {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
        setLinkPopover({ visible: false, url: "" });
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [linkPopover.visible]);

  // Sync QB data into local state when it loads / changes
  useEffect(() => {
    if (quickBit) {
      setTitle((quickBit as QuickBit).title || "");
      setExpiresAt((quickBit as QuickBit).expiresAt);
      setNotificationHours((quickBit as QuickBit).notificationHours ?? []);
      expiredWhileEditing.current = false;
    }
  }, [(quickBit as QuickBit | undefined)?.id]);

  // Tick every 60s to refresh countdown display and detect expiry
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (expiresAt && new Date(expiresAt) <= new Date() && !expiredWhileEditing.current) {
        expiredWhileEditing.current = true;
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isDemoRef = useRef(isDemo);
  isDemoRef.current = isDemo;

  const debouncedSave = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      return (id: number, data: Partial<{ title: string; content: string; contentText: string }>) => {
        if (isDemoRef.current) return;
        setSaveStatus("saving");
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          try {
            await updateMut.mutateAsync({ id, data });
            queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
            setSaveStatus("saved");
          } catch {
            setSaveStatus("saved");
          }
        }, 800);
      };
    })(),
    []
  );

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
      TaskItem.configure({ nested: true }),
      SlashCommandExtension,
      SuperscriptExt,
      SubscriptExt,
    ],
    content: (quickBit as QuickBit | undefined)?.content || "",
    onUpdate: ({ editor }) => {
      if (selectedQuickBitId) debouncedSave(selectedQuickBitId, { content: editor.getHTML(), contentText: editor.getText() });
    },
    editorProps: {
      attributes: { class: "prose prose-invert max-w-none focus:outline-none" },
    },
  }, [selectedQuickBitId]);

  // Sync content when QB changes
  useEffect(() => {
    if (quickBit && editor) {
      const content = (quickBit as QuickBit).content || "";
      if (editor.getHTML() !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    } else if (editor && !quickBit) {
      editor.commands.setContent("", { emitUpdate: false });
      setTitle("");
    }
  }, [(quickBit as QuickBit | undefined)?.id, selectedQuickBitId, editor]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedQuickBitId) debouncedSave(selectedQuickBitId, { title: newTitle });
  };

  const openLinkPopover = () => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href || "";
    setLinkPopover({ visible: true, url: existing });
    setTimeout(() => linkInputRef.current?.focus(), 30);
  };

  const applyLink = () => {
    if (!editor) return;
    const trimmed = linkPopover.url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkPopover({ visible: false, url: "" });
  };

  const handleExpirySelect = async (isoDate: string) => {
    if (!selectedQuickBitId) return;
    setExpiresAt(isoDate);
    setExpiryPickerOpen(false);
    expiredWhileEditing.current = false;
    if (!isDemo) {
      try {
        await updateMut.mutateAsync({ id: selectedQuickBitId, data: { expiresAt: isoDate } });
        queryClient.invalidateQueries({ queryKey: getGetQuickBitQueryKey(selectedQuickBitId) });
        queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
      } catch {}
    }
  };

  const handleNotificationsChange = async (hours: number[]) => {
    if (!selectedQuickBitId) return;
    setNotificationHours(hours);
    if (!isDemo) {
      try {
        await updateMut.mutateAsync({ id: selectedQuickBitId, data: { notificationHours: hours } });
        queryClient.invalidateQueries({ queryKey: getGetQuickBitQueryKey(selectedQuickBitId) });
      } catch {}
    }
  };

  const handleDelete = async () => {
    if (!selectedQuickBitId) return;
    if (confirm("Are you sure you want to delete this Quick Bit?")) {
      if (!isDemo) {
        try {
          await deleteMut.mutateAsync({ id: selectedQuickBitId });
          queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
        } catch {}
      }
      selectQuickBit(null);
      if (bp !== "desktop") setMobileView("list");
    }
  };

  const handlePromote = async () => {
    if (!selectedQuickBitId || !quickBit) return;
    if (isDemo) return;
    const qb = quickBit as QuickBit;
    try {
      const res = await createNoteMut.mutateAsync({
        data: { title: qb.title || "", content: qb.content || "" },
      });
      await deleteMut.mutateAsync({ id: selectedQuickBitId });
      queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectQuickBit(null);
      setFilter("all");
      selectNote(res.id);
    } catch {}
  };

  const handleBack = () => {
    if (expiredWhileEditing.current) {
      setShowExpiredModal(true);
      return;
    }
    setMobileView("list");
    selectQuickBit(null);
  };

  const callAI = async (action: string, customInstruction?: string) => {
    if (!editor) return;
    const sel = savedAiSelection.current ?? (() => {
      const { from, to } = editor.state.selection;
      return { from, to, text: editor.state.doc.textBetween(from, to) };
    })();
    if (!sel.text) return;

    const provider = (localStorage.getItem("ai_provider") || "openai") as string;
    const apiKey = localStorage.getItem(`ai_key_${provider}`) || "";
    if (!apiKey) {
      setAiError("No AI API key configured. Open Settings → AI to add one.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }
    const model = localStorage.getItem("ai_model") || "";
    if (!model) {
      setAiError("No AI model configured. Open Settings → AI to select one.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }

    const prompts: Record<string, string> = {
      shorter_25: `Make the following text approximately 25% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${sel.text}`,
      shorter_50: `Make the following text approximately 50% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${sel.text}`,
      shorter_custom: `Make the following text shorter. Additional instruction: ${customInstruction || ""}. Return only the shortened text, no explanations:\n\n${sel.text}`,
      longer_25: `Expand the following text by approximately 25% with more detail and context. Return only the expanded text, no explanations:\n\n${sel.text}`,
      longer_50: `Expand the following text by approximately 50% with more detail and context. Return only the expanded text, no explanations:\n\n${sel.text}`,
      longer_custom: `Expand the following text. Additional instruction: ${customInstruction || ""}. Return only the expanded text, no explanations:\n\n${sel.text}`,
      proofread: `Proofread and fix grammar, spelling, and punctuation in the following text. Do not change wording or structure. Return only the corrected text, no explanations:\n\n${sel.text}`,
      simplify: `Rewrite the following text using shorter sentences and simpler vocabulary. Keep the same length and meaning. Return only the simplified text, no explanations:\n\n${sel.text}`,
      improve: `Enhance the clarity, flow, and word choice of the following text while preserving its original meaning. Return only the improved text, no explanations:\n\n${sel.text}`,
      rewrite: `Completely rephrase the following text while preserving its core meaning. Return only the rewritten text, no explanations:\n\n${sel.text}`,
      tone_casual: `Rewrite the following text in a casual tone. Return only the rewritten text, no explanations:\n\n${sel.text}`,
      tone_professional: `Rewrite the following text in a professional tone. Return only the rewritten text, no explanations:\n\n${sel.text}`,
      tone_friendly: `Rewrite the following text in a friendly tone. Return only the rewritten text, no explanations:\n\n${sel.text}`,
      tone_direct: `Rewrite the following text in a direct tone. Return only the rewritten text, no explanations:\n\n${sel.text}`,
      tone_custom: `Rewrite the following text with the following tone/style: ${customInstruction || ""}. Return only the rewritten text, no explanations:\n\n${sel.text}`,
      summarize_short: `Summarize the following text in 1-2 sentences. Return only the summary, no explanations:\n\n${sel.text}`,
      summarize_balanced: `Summarize the following text in a short paragraph. Return only the summary, no explanations:\n\n${sel.text}`,
      summarize_detailed: `Summarize the following text as detailed bullet points. Return only the bullet-point summary, no explanations:\n\n${sel.text}`,
      summarize_custom: `Summarize the following text. Additional instruction: ${customInstruction || ""}. Return only the summary, no explanations:\n\n${sel.text}`,
      extract_action_items: `Extract all action items, tasks, and to-dos from the following text. Return them as a bulleted list. If no action items are found, return "No action items found.", no explanations:\n\n${sel.text}`,
    };

    const prompt = prompts[action];
    if (!prompt) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await authenticatedFetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const result: string = data.result || "";
      if (result) {
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

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!selectedQuickBitId) {
    if (bp === "mobile") return null;
    return (
      <div className="flex-1 flex flex-col bg-background relative">
        {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
          <div className="h-14 border-b border-panel-border flex items-center px-2 gap-1 bg-background/80 backdrop-blur-md shrink-0">
            {!isSidebarOpen && (
              <IconButton onClick={toggleSidebar} title="Show sidebar">
                <PanelLeft className="w-4 h-4" />
              </IconButton>
            )}
            {!isNoteListOpen && (
              <IconButton onClick={toggleNoteList} title="Show note list">
                <PanelLeftClose className="w-4 h-4 scale-x-[-1]" />
              </IconButton>
            )}
          </div>
        )}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <Zap className="w-16 h-16 mb-4 opacity-20" />
          <h2 className="text-xl font-medium mb-2 text-foreground/80">Select a Quick Bit</h2>
          <p className="text-sm">Choose a Quick Bit from the list or create a new one.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !editor) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const qb = quickBit as QuickBit;
  const expiry = expiresAt ? formatExpiry(expiresAt) : { label: "—", className: "text-muted-foreground/70" };
  const isExpiredNow = expiresAt ? new Date(expiresAt) <= new Date() : false;
  const reminderCount = notificationHours.length;

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden relative">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
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
                  <PanelLeft className="w-4 h-4" />
                </IconButton>
              )}
              {!isNoteListOpen && (
                <IconButton onClick={toggleNoteList} title="Show note list">
                  <PanelLeftClose className="w-4 h-4 scale-x-[-1]" />
                </IconButton>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", saveStatus === "saved" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
            {saveStatus === "saved" ? "Saved" : "Saving..."}
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          {bp === "mobile" && editor && (
            <>
              <IconButton
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo"
                className={!editor.can().undo() ? "opacity-30 pointer-events-none" : ""}
              >
                <Undo2 className="w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo"
                className={!editor.can().redo() ? "opacity-30 pointer-events-none" : ""}
              >
                <Redo2 className="w-4 h-4" />
              </IconButton>
            </>
          )}
          {bp === "desktop" && (
            <>
              <div className="w-px h-4 bg-panel-border mx-1" />
              <IconButton
                onClick={handleDelete}
                className="hover:text-destructive hover:bg-destructive/10"
                title="Delete Quick Bit"
              >
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </>
          )}
        </div>
      </header>

      {/* ── QB Info Bar ─────────────────────────────────────────────────────── */}
      <div className="h-10 border-b border-panel-border bg-background/60 px-4 flex items-center gap-4 shrink-0 overflow-x-auto">
        {/* Expiration */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
          {isExpiredNow ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500 font-medium">Expired</span>
              <button
                onClick={() => setExpiryPickerOpen(true)}
                ref={expiryBtnRef}
                className="text-xs text-primary hover:underline"
              >
                Extend
              </button>
              <button
                onClick={handlePromote}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Promote
              </button>
              <button
                onClick={handleDelete}
                className="text-xs text-destructive hover:underline"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              ref={expiryBtnRef}
              onClick={() => setExpiryPickerOpen(true)}
              className={cn("text-xs hover:opacity-80 transition-opacity", expiry.className)}
            >
              {expiry.label}
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-panel-border shrink-0" />

        {/* Notifications */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Bell className="w-3.5 h-3.5 text-muted-foreground/60" />
          <button
            ref={notifBtnRef}
            onClick={() => setNotifPopoverOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {reminderCount === 0 ? "No reminders" : `${reminderCount} reminder${reminderCount !== 1 ? "s" : ""}`}
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-panel-border shrink-0 ml-auto" />

        {/* Promote to Note */}
        <button
          onClick={handlePromote}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <FileText className="w-3.5 h-3.5" />
          Promote to Note
        </button>
      </div>

      {/* ── Toolbar (desktop/tablet) ─────────────────────────────────────────── */}
      {bp !== "mobile" && (
        <EditorToolbar
          editor={editor}
          linkPopover={linkPopover}
          setLinkPopover={setLinkPopover}
          linkInputRef={linkInputRef}
          linkPopoverRef={linkPopoverRef}
          openLinkPopover={openLinkPopover}
          applyLink={applyLink}
          showUndoRedo
        />
      )}

      {/* ── AI selection menus ───────────────────────────────────────────────── */}
      {bp === "mobile" ? (
        <MobileSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={(from, to, text) => { savedAiSelection.current = { from, to, text }; }}
        />
      ) : (
        <AiSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={(from, to, text) => { savedAiSelection.current = { from, to, text }; }}
        />
      )}

      {/* ── AI loading / error ───────────────────────────────────────────────── */}
      {(aiLoading || aiError) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          {aiLoading ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-indigo-500/30 rounded-full shadow-xl text-indigo-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">AI is rewriting…</span>
            </div>
          ) : aiError ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-destructive/30 rounded-full shadow-xl text-destructive pointer-events-auto">
              <X className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{aiError}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Editor content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn("max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12", bp === "mobile" && "pb-20")}>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Quick Bit Title"
            className="w-full text-2xl md:text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
          />
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Slash command menu ───────────────────────────────────────────────── */}
      <SlashCommandMenu editor={editor} />

      {/* ── Mobile bottom toolbar ───────────────────────────────────────────── */}
      {bp === "mobile" && (
        <EditorToolbar
          editor={editor}
          linkPopover={linkPopover}
          setLinkPopover={setLinkPopover}
          linkInputRef={linkInputRef}
          linkPopoverRef={linkPopoverRef}
          openLinkPopover={openLinkPopover}
          applyLink={applyLink}
          className="fixed left-0 right-0 z-40 border-t border-panel-border bg-background/95 backdrop-blur-md"
          style={{ bottom: keyboardHeight > 0 ? keyboardHeight : 0 }}
        />
      )}

      {/* ── Portals ─────────────────────────────────────────────────────────── */}
      {expiryPickerOpen && (
        <ExpiryPicker
          anchorRef={expiryBtnRef}
          onSelect={handleExpirySelect}
          onClose={() => setExpiryPickerOpen(false)}
        />
      )}
      {notifPopoverOpen && (
        <NotificationPopover
          anchorRef={notifBtnRef}
          value={notificationHours}
          onChange={handleNotificationsChange}
          onClose={() => setNotifPopoverOpen(false)}
        />
      )}
      {showExpiredModal && (
        <ExpiredModal
          onExtend={() => { setShowExpiredModal(false); setExpiryPickerOpen(true); }}
          onPromote={async () => { setShowExpiredModal(false); await handlePromote(); }}
          onDelete={async () => {
            setShowExpiredModal(false);
            if (!selectedQuickBitId) return;
            if (!isDemo) {
              try {
                await deleteMut.mutateAsync({ id: selectedQuickBitId });
                queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
              } catch {}
            }
            selectQuickBit(null);
            setMobileView("list");
          }}
        />
      )}
    </div>
  );
}
