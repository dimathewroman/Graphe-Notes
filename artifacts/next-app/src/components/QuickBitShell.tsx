// QuickBitShell — wrapper around GrapheEditor for Quick Bits.
// Contains the QB header (expiry, notifications, promote-to-note), auto-save, and all
// QB-specific orchestration. The actual TipTap editor lives in GrapheEditor.

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, useAnimation } from "framer-motion";
import * as Sentry from "@sentry/nextjs";
import { createPortal } from "react-dom";
import { EditorContent } from "@tiptap/react";

import { useAppStore } from "@/store";
import {
  useGetQuickBit,
  useUpdateQuickBit,
  useDeleteQuickBit,
  useSoftDeleteQuickBit,
  useCreateNote,
  getGetQuickBitsQueryKey,
  getGetQuickBitQueryKey,
  getGetNoteQueryKey,
  getGetNotesQueryKey,
} from "@workspace/api-client-react";
import type { QuickBit } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, PanelLeft, PanelLeftClose, Trash2, FileText, Menu,
  Clock, Bell, Zap, ArrowUpFromLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { NotificationCadenceEditor } from "./NotificationCadenceEditor";
import { useDemoMode } from "@/lib/demo-context";
import { DEMO_QUICK_BITS } from "@/lib/demo-data";
import { GrapheEditor } from "./editor/GrapheEditor";
import { useAnimationConfig } from "@/hooks/use-motion";
import posthog from "posthog-js";

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

// ─── Expired modal ────────────────────────────────────────────────────────────

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
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover active-elevate-2"
          >
            Extend expiration
          </button>
          <button
            onClick={onPromote}
            className="w-full py-2.5 rounded-xl bg-panel border border-panel-border text-sm font-medium text-foreground hover:bg-panel-hover active-elevate-2"
          >
            Promote to Note
          </button>
          <button
            onClick={onDelete}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 active-elevate-2"
          >
            Delete and exit
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── QuickBitShell ────────────────────────────────────────────────────────────

export function QuickBitShell() {
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
    addDemoNoteId,
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
  const softDeleteMut = useSoftDeleteQuickBit();
  const createNoteMut = useCreateNote();

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  // Expiry state
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tick, setTick] = useState(0); // forces re-render every minute
  const [expiryPickerOpen, setExpiryPickerOpen] = useState(false);
  const expiryBtnRef = useRef<HTMLButtonElement>(null);
  const expiredWhileEditing = useRef(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  // Notifications state
  const [notificationHours, setNotificationHours] = useState<number[]>([]);
  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  const isDemoRef = useRef(isDemo);
  isDemoRef.current = isDemo;

  // ── Content crossfade animation (mirrors NoteShell) ────────────────────────
  const anim = useAnimationConfig();
  const animRef = useRef(anim);
  animRef.current = anim;
  const contentControls = useAnimation();
  const prevQbIdForAnim = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const prevId = prevQbIdForAnim.current;
    prevQbIdForAnim.current = selectedQuickBitId;
    if (prevId === undefined) {
      contentControls.set({ opacity: 1, y: 0 });
      return;
    }
    if (!selectedQuickBitId) return;
    const isNew = prevId === null;
    const a = animRef.current;
    const runAnim = async () => {
      if (isNew) {
        contentControls.set({ opacity: 0, y: a.level === "full" ? 12 : 0 });
        await contentControls.start({ opacity: 1, y: 0, transition: a.standardTransition });
      } else {
        await contentControls.start({ opacity: 0, y: a.level === "full" ? 4 : 0, transition: { duration: 0.1, ease: "easeOut" as const } });
        contentControls.set({ y: 0 });
        await contentControls.start({ opacity: 1, y: 0, transition: a.level === "minimal" ? { duration: 0.1 } : a.fastTransition });
      }
    };
    try { runAnim(); } catch (err) { Sentry.captureException(err); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuickBitId]);

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

  const handleContentChange = useCallback((html: string, text: string) => {
    if (selectedQuickBitId) debouncedSave(selectedQuickBitId, { content: html, contentText: text });
  }, [selectedQuickBitId, debouncedSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedQuickBitId) debouncedSave(selectedQuickBitId, { title: newTitle });
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
    if (isDemo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = queryClient.getQueryData<any>(getGetQuickBitQueryKey(selectedQuickBitId));
      if (existing) {
        const now = new Date();
        const tempId = -(Date.now() + (Math.random() * 1000 | 0));
        queryClient.setQueryData(getGetNoteQueryKey(tempId), {
          id: tempId,
          title: existing.title,
          content: existing.content,
          contentText: existing.contentText,
          folderId: null,
          tags: [],
          pinned: false,
          favorite: false,
          coverImage: null,
          vaulted: false,
          deletedAt: now.toISOString(),
          autoDeleteAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
          deletedReason: "deleted",
          _demoDeleted: true,
          _isQuickBit: true,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        });
        addDemoNoteId(tempId);
        queryClient.setQueryData(getGetQuickBitQueryKey(selectedQuickBitId), null);
        queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
      }
    } else {
      try {
        await softDeleteMut.mutateAsync({ id: selectedQuickBitId });
        queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      } catch {}
    }
    selectQuickBit(null);
    if (bp !== "desktop") setMobileView("list");
  };

  const handlePromote = async () => {
    if (!selectedQuickBitId || !quickBit) return;
    if (isDemo) return;
    posthog.capture("promote_to_note_clicked", { quick_bit_id: selectedQuickBitId, timestamp: new Date().toISOString() });
    const qb = quickBit as QuickBit;
    try {
      const res = await createNoteMut.mutateAsync({
        data: { title: qb.title || "", content: qb.content || "" },
      });
      await deleteMut.mutateAsync({ id: selectedQuickBitId });
      posthog.capture("quick_bit_promoted_to_note", { quick_bit_id: selectedQuickBitId, note_id: res.id });
      queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectQuickBit(null);
      setFilter("all");
      selectNote(res.id);
    } catch {}
  };

  // Attach images into the editor as base64 data URLs — no server upload needed for QBs.
  // The data URL is stored inline in the QB content HTML and persists across saves.
  // Non-image files are ignored (QBs don't have an attachment panel like notes do).
  const handleAttachFile = useCallback(async (file: File): Promise<{ url?: string } | undefined> => {
    if (!file.type.startsWith("image/")) return undefined;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string });
      reader.onerror = () => {
        Sentry.captureException(reader.error, { extra: { fileName: file.name, fileType: file.type } });
        resolve(undefined);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleBack = () => {
    if (expiredWhileEditing.current) {
      setShowExpiredModal(true);
      return;
    }
    setMobileView("list");
    selectQuickBit(null);
  };

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!selectedQuickBitId) {
    if (bp === "mobile") return null;
    return (
      <div className="flex-1 flex flex-col bg-editor relative">
        {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
          <div className="h-14 border-b border-panel-border flex items-center px-2 gap-1 bg-editor/80 backdrop-blur-md shrink-0">
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

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const qb = quickBit as QuickBit;
  const expiry = expiresAt ? formatExpiry(expiresAt) : { label: "—", className: "text-muted-foreground/70" };
  const isExpiredNow = expiresAt ? new Date(expiresAt) <= new Date() : false;
  const reminderCount = notificationHours.length;

  return (
    <div className="flex-1 flex flex-col bg-editor h-screen overflow-hidden relative">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-panel-border flex items-center px-2 md:px-4 shrink-0 bg-editor/80 backdrop-blur-md z-10 gap-2 md:gap-3 overflow-hidden">
        {bp === "mobile" && (
          <button
            onClick={handleBack}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
          <div className="flex items-center gap-0.5 shrink-0">
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

        {/* Save status — icon-only on mobile */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground shrink-0">
          <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", saveStatus === "saved" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
          <span className="hidden md:inline">{saveStatus === "saved" ? "Saved" : "Saving..."}</span>
        </div>

        {/* Expiration */}
        <div className="flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          {isExpiredNow ? (
            <button onClick={() => setExpiryPickerOpen(true)} ref={expiryBtnRef} className="text-xs text-red-500 font-medium">Expired</button>
          ) : (
            <button ref={expiryBtnRef} onClick={() => setExpiryPickerOpen(true)} className={cn("text-xs hover:opacity-80 transition-opacity whitespace-nowrap", expiry.className)}>
              {expiry.label}
            </button>
          )}
        </div>

        {/* Notifications — hidden on mobile, icon-only tap target */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <div className="w-px h-4 bg-panel-border shrink-0" />
          <Bell className="w-3.5 h-3.5 text-muted-foreground/60" />
          <button ref={notifBtnRef} onClick={() => setNotifPopoverOpen(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {reminderCount === 0 ? "No reminders" : `${reminderCount} reminder${reminderCount !== 1 ? "s" : ""}`}
          </button>
        </div>
        {bp === "mobile" && (
          <button ref={notifBtnRef} onClick={() => setNotifPopoverOpen(true)} className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors relative" title="Reminders">
            <Bell className="w-4 h-4 text-muted-foreground" />
            {reminderCount > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        )}

        {/* Right side actions */}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <IconButton onClick={handleDelete} className="hover:text-destructive hover:bg-destructive/10" title="Delete Quick Bit">
            <Trash2 className="w-4 h-4" />
          </IconButton>
          <motion.button
            onClick={handlePromote}
            title="Promote to Note"
            className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #5B93E8 0%, #7B6CE8 100%)" }}
            whileHover={anim.useScale ? {
              scale: 1.03,
              boxShadow: "0 4px 16px rgba(91, 147, 232, 0.45)",
            } : undefined}
            whileTap={anim.level !== "minimal" ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Promote to Note</span>
          </motion.button>
        </div>
      </header>

      {/* ── GrapheEditor (toolbar + AI menus + content) ──────────────────── */}
      <GrapheEditor
        content={(qb as QuickBit | undefined)?.content ?? ""}
        contentKey={(qb as QuickBit | undefined)?.id}
        onContentChange={handleContentChange}
        mode="quickbit"
        isDemo={isDemo}
        onAttachFile={handleAttachFile}
        renderContent={(editor) => (
          <motion.div animate={contentControls} initial={{ opacity: 1 }} className="flex-1 overflow-y-auto">
            <div
              className={cn("max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12", bp === "mobile" && "pb-20")}
              style={bp === "mobile" && keyboardHeight > 0 ? { paddingBottom: `calc(5rem + ${keyboardHeight}px)` } : undefined}
            >
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Quick Bit Title"
                className="w-full text-2xl md:text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
              />
              <EditorContent editor={editor} />
            </div>
          </motion.div>
        )}
      />

      {/* ── Portals ─────────────────────────────────────────────────────── */}
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
            await handleDelete();
          }}
        />
      )}
    </div>
  );
}
