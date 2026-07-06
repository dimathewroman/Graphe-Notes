"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Trash2, MoreVertical, Menu, PanelLeft, Lock, ShieldCheck, ZapOff, Zap } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "./ui/alert-dialog";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import {
  useGetNotes,
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
import { DEMO_NOTES } from "@/lib/demo-data";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "./ui/empty";
import { ScrollArea } from "./ui/scroll-area";

function daysUntil(dateStr: string | null | undefined): number {
  if (!dateStr) return 30;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.max(1, Math.ceil(ms / 86400000));
}

export function RecentlyDeleted() {
  // Atomic Zustand selectors (E1) — one subscription per value.
  const selectedNoteId = useAppStore(s => s.selectedNoteId);
  const selectNote = useAppStore(s => s.selectNote);
  const setMobileView = useAppStore(s => s.setMobileView);
  const isSidebarOpen = useAppStore(s => s.isSidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen);
  const isVaultUnlocked = useAppStore(s => s.isVaultUnlocked);
  const demoExtraIds = useAppStore(s => s.demoExtraIds);
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  const [showOverflow, setShowOverflow] = useState(false);
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflow(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Non-demo: fetch deleted notes from API ──────────────────────────────────
  const { data: apiNotes = [], isLoading: apiLoading } = useGetNotes(
    { deleted: true } as any,
    { query: { enabled: !isDemo, queryKey: getGetNotesQueryKey({ deleted: true } as any) } }
  );

  // ── Demo: read from individual note caches, filter to _demoDeleted ──────────
  const demoNoteQueries = useQueries({
    queries: isDemo
      ? [...DEMO_NOTES.map((n) => n.id), ...demoExtraIds].map((id) => {
          const fallback = DEMO_NOTES.find((n) => n.id === id);
          return {
            queryKey: getGetNoteQueryKey(id),
            queryFn: fallback
              ? () => fallback
              : async () => queryClient.getQueryData<Note>(getGetNoteQueryKey(id)),
            initialData: fallback,
            staleTime: Infinity,
            gcTime: Infinity,
            enabled: true,
          };
        })
      : [],
  });

  const rawNotes: (Note & { _demoDeleted?: boolean; _isQuickBit?: boolean; _demoPermanentlyDeleted?: boolean })[] = isDemo
    ? ([...new Map(
        demoNoteQueries.map((q) => q.data).filter(Boolean).map((n) => [(n as any).id, n])
      ).values()] as any[])
    : (apiNotes as Note[]);

  // Sort by autoDeleteAt ascending (soonest expiring first) and apply vault filter
  const notes = useMemo(() => {
    let list = rawNotes;

    if (isDemo) {
      // Keep only soft-deleted, not permanently deleted
      list = list.filter((n: any) => n._demoDeleted && !n._demoPermanentlyDeleted);
    }

    // Vault filter: hide vault notes when locked
    const visible = list.filter((n) => {
      if (n.vaulted && !isVaultUnlocked) return false;
      return true;
    });

    return [...visible].sort((a, b) => {
      const aMs = a.autoDeleteAt ? new Date(a.autoDeleteAt as string).getTime() : 0;
      const bMs = b.autoDeleteAt ? new Date(b.autoDeleteAt as string).getTime() : 0;
      return aMs - bMs;
    });
  }, [rawNotes, isVaultUnlocked, isDemo]);

  const hasLockedVaultNotes = useMemo(() => {
    if (isVaultUnlocked) return false;
    return rawNotes.some((n: any) => n.vaulted && !n._demoPermanentlyDeleted);
  }, [rawNotes, isVaultUnlocked]);

  const permanentDeleteMut = usePermanentDeleteNote();

  const handleEmptyConfirm = async () => {
    setShowConfirmEmpty(false);
    if (isDemo) {
      for (const note of notes) {
        const existing = queryClient.getQueryData<any>(getGetNoteQueryKey(note.id));
        if (existing) {
          queryClient.setQueryData(getGetNoteQueryKey(note.id), {
            ...existing,
            _demoDeleted: false,
            _demoPermanentlyDeleted: true,
          });
        }
      }
      if (selectedNoteId && notes.some((n) => n.id === selectedNoteId)) {
        selectNote(null);
      }
      return;
    }
    for (const note of notes) {
      try {
        await permanentDeleteMut.mutateAsync({ id: note.id, data: { confirm: true } });
      } catch {}
    }
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    if (selectedNoteId && notes.some((n) => n.id === selectedNoteId)) {
      selectNote(null);
    }
  };

  const isLoading = isDemo ? false : apiLoading;

  // Counts for the confirmation dialog
  const regularCount = notes.filter((n) => (n as any).deletedReason !== "expired" && !(n as any)._isQuickBit).length;
  const qbCount = notes.filter((n) => (n as any).deletedReason === "expired" || (n as any)._isQuickBit).length;

  const containerClass =
    bp === "mobile"
      ? "flex-1 bg-background flex flex-col h-dvh"
      : "bg-background flex flex-col h-dvh w-full overflow-hidden";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="p-4 border-b border-panel-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {bp !== "desktop" && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="min-w-[44px] min-h-[44px] -ml-1 mr-1 rounded-lg hover:bg-panel transition-colors flex items-center justify-center"
              >
                <Menu className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            {bp === "desktop" && !isSidebarOpen && (
              <IconButton onClick={toggleSidebar} title="Show sidebar">
                <PanelLeft className="w-4 h-4" />
              </IconButton>
            )}
            <h2 className="text-lg font-semibold tracking-tight truncate">Recently Deleted</h2>
          </div>
          {/* Overflow menu */}
          <div className="relative" ref={overflowRef}>
            <IconButton
              onClick={() => setShowOverflow(!showOverflow)}
              title="More options"
              active={showOverflow}
            >
              <MoreVertical className="w-4 h-4" />
            </IconButton>
            {showOverflow && (
              <div className="absolute right-0 top-full mt-1 z-40 min-w-[200px] bg-popover border border-panel-border rounded-xl shadow-xl py-1">
                <button
                  onClick={() => {
                    setShowOverflow(false);
                    setShowConfirmEmpty(true);
                  }}
                  disabled={notes.length === 0}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Empty Recently Deleted
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm empty dialog */}
      <AlertDialog open={showConfirmEmpty} onOpenChange={setShowConfirmEmpty}>
        <AlertDialogContent className="bg-popover border-panel-border rounded-2xl shadow-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Empty Recently Deleted</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              {regularCount > 0 && (
                <span className="font-medium text-foreground">{regularCount} note{regularCount !== 1 ? "s" : ""}</span>
              )}
              {regularCount > 0 && qbCount > 0 && " and "}
              {qbCount > 0 && (
                <span className="font-medium text-foreground">{qbCount} Quick Bit{qbCount !== 1 ? "s" : ""}</span>
              )}
              {regularCount === 0 && qbCount === 0 && (
                <span className="font-medium text-foreground">0 items</span>
              )}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="ghost">Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleEmptyConfirm}>Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0 [&_[data-slot=scroll-area-viewport]>div]:!block">
      <div className="p-2 space-y-1">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 && !hasLockedVaultNotes ? (
          <div className="h-full flex items-center justify-center p-4">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Trash2 className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Nothing here</EmptyTitle>
                <EmptyDescription>
                  Deleted notes appear here and are permanently removed after 30 days.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <>
            {notes.map((note) => {
              const days = daysUntil((note as any).autoDeleteAt);
              return (
                <div
                  key={note.id}
                  onClick={() => { selectNote(note.id); if (bp === "mobile") setMobileView("editor"); }}
                  className={cn(
                    "p-3 rounded-xl cursor-pointer border transition-all duration-200 group",
                    selectedNoteId === note.id
                      ? "bg-panel border-primary/50 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-panel hover:border-panel-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-medium truncate text-sm text-foreground/90 flex items-center gap-1.5">
                      {note.vaulted && <ShieldCheck className="w-3 h-3 shrink-0 text-ai-accent" />}
                      {note.title || "Untitled Note"}
                    </h3>
                    {/* Badge / type indicator */}
                    {note.vaulted ? (
                      <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs border border-ai-accent/30 text-ai-accent">
                        <Lock className="w-2.5 h-2.5" />
                        Vault
                      </span>
                    ) : (note as any).deletedReason === "expired" ? (
                      <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs bg-warning/10 border border-warning/30 text-warning">
                        <ZapOff className="w-2.5 h-2.5" />
                        Expired
                      </span>
                    ) : (note as any)._isQuickBit ? (
                      // X-R5: a converted/deleted quick bit isn't "Expired" — label it distinctly.
                      <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs bg-primary/10 border border-primary/30 text-primary">
                        <Zap className="w-2.5 h-2.5" />
                        Quick Bit
                      </span>
                    ) : (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full text-2xs bg-muted text-muted-foreground border border-panel-border">
                        Deleted
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-muted-foreground/70 font-mono">
                    {days} day{days !== 1 ? "s" : ""} remaining
                  </p>
                </div>
              );
            })}

            {/* Locked vault notes prompt */}
            {hasLockedVaultNotes && (
              <div className="p-3 rounded-xl border border-dashed border-panel-border text-center">
                <Lock className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">
                  Unlock your vault to reveal hidden notes
                </p>
              </div>
            )}
          </>
        )}
      </div>
      </ScrollArea>
    </div>
  );
}
