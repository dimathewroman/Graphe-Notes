"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuickBitsQueryKey, getGetQuickBitQueryKey, getGetNoteQueryKey, getGetNotesQueryKey } from "@workspace/api-client-react";
import type { QuickBit } from "@workspace/api-client-react";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useAppStore } from "@/store";
import { useDemoMode } from "@/lib/demo-context";
import { DEMO_QUICK_BITS } from "@/lib/demo-data";

// ─── Expiry label (same logic as QuickBitList / QuickBitEditor) ───────────────

function formatExpiryLabel(expiresAt: string): { label: string; className: string } {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  const totalMinutes = msLeft / (1000 * 60);
  const totalHours = msLeft / (1000 * 60 * 60);
  if (msLeft <= 0) return { label: "Expired", className: "text-red-500" };
  if (totalHours < 1) {
    const m = Math.ceil(totalMinutes);
    return { label: `${m} minute${m !== 1 ? "s" : ""} left`, className: "text-red-500" };
  }
  if (totalHours < 24) {
    const h = Math.ceil(totalHours);
    return { label: `${h} hour${h !== 1 ? "s" : ""} left`, className: "text-red-500" };
  }
  const d = Math.ceil(totalHours / 24);
  const className = totalHours < 48 ? "text-amber-500" : "text-muted-foreground/70";
  return { label: `${d} day${d !== 1 ? "s" : ""} left`, className };
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = "qb_reminders_shown";

function getShown(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function markShown(key: string) {
  const shown = getShown();
  shown[key] = true;
  localStorage.setItem(LS_KEY, JSON.stringify(shown));
}

function isShown(key: string): boolean {
  return !!getShown()[key];
}

function pruneShown(activeIds: number[]) {
  const shown = getShown();
  const activeSet = new Set(activeIds.map(String));
  const pruned = Object.fromEntries(
    Object.entries(shown).filter(([k]) => activeSet.has(k.split("_")[0]))
  );
  localStorage.setItem(LS_KEY, JSON.stringify(pruned));
}

// ─── Notification type ────────────────────────────────────────────────────────

interface QBNotification {
  qbId: number;
  title: string;
  expiresAt: string;
  thresholdHours: number;
  key: string;
}

// ─── Threshold detection ──────────────────────────────────────────────────────

function findNewNotifications(quickBits: QuickBit[]): QBNotification[] {
  const now = Date.now();
  const results: QBNotification[] = [];

  for (const qb of quickBits) {
    if (!qb.notificationHours?.length) continue;
    const expiresMs = new Date(qb.expiresAt).getTime();
    if (expiresMs <= now) continue; // expired — cleanup handles these

    for (const hours of qb.notificationHours) {
      const thresholdMs = expiresMs - hours * 3_600_000;
      const key = `${qb.id}_${hours}`;
      if (now >= thresholdMs && !isShown(key)) {
        results.push({
          qbId: qb.id,
          title: qb.title,
          expiresAt: qb.expiresAt,
          thresholdHours: hours,
          key,
        });
        markShown(key); // mark immediately so re-renders don't re-queue
      }
    }
  }

  return results;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickBitNotifications() {
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();
  const { selectQuickBit, setFilter, addDemoNoteId } = useAppStore();

  const [expiredCount, setExpiredCount] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<QBNotification[]>([]);

  // In demo mode: detect expired QBs from cache, convert them to soft-deleted note cache entries
  const runDemoExpiry = useCallback(() => {
    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + 30 * 86_400_000);
    let count = 0;
    const allQbs: QuickBit[] = DEMO_QUICK_BITS.map((qb) => {
      const cached = queryClient.getQueryData<QuickBit>(getGetQuickBitQueryKey(qb.id));
      return cached ?? qb;
    });
    for (const qb of allQbs) {
      if (new Date(qb.expiresAt) > now) continue;
      // Already converted? Check if QB cache entry still exists
      const existing = queryClient.getQueryData<QuickBit>(getGetQuickBitQueryKey(qb.id));
      if (!existing) continue;
      // Create a soft-deleted note entry for this expired QB
      const tempId = -(Date.now() + Math.random() * 1000 | 0);
      queryClient.setQueryData(getGetNoteQueryKey(tempId), {
        id: tempId,
        title: qb.title,
        content: qb.content,
        contentText: qb.contentText,
        folderId: null,
        tags: [],
        pinned: false,
        favorite: false,
        coverImage: null,
        vaulted: false,
        deletedAt: now.toISOString(),
        autoDeleteAt: autoDeleteAt.toISOString(),
        deletedReason: "expired",
        _demoDeleted: true,
        _isQuickBit: true,
        createdAt: qb.createdAt,
        updatedAt: qb.updatedAt,
      });
      addDemoNoteId(tempId);
      // Null out the QB cache entry so it disappears from QuickBitList
      queryClient.setQueryData(getGetQuickBitQueryKey(qb.id), null);
      count++;
    }
    if (count > 0) {
      setExpiredCount(count);
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    }
  }, [queryClient, addDemoNoteId]);

  const runCheck = useCallback(async () => {
    if (isDemo) {
      runDemoExpiry();
      return;
    }
    try {
      const res = await authenticatedFetch("/api/quick-bits");
      if (!res.ok) return;
      const qbs: QuickBit[] = await res.json();
      pruneShown(qbs.map((q) => q.id));
      const newNotifs = findNewNotifications(qbs);
      if (newNotifs.length) {
        setNotifications((prev) => [...newNotifs, ...prev]);
      }
      // Keep the QB list cache fresh after each check
      queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
    } catch {
      // Silent failure — notifications are non-critical
    }
  }, [isDemo, runDemoExpiry, queryClient]);

  useEffect(() => {
    if (isDemo) {
      // Demo: check for expired QBs immediately and then hourly
      runDemoExpiry();
      const now = new Date();
      const msUntilNextHour =
        (60 - now.getMinutes()) * 60_000 -
        now.getSeconds() * 1000 -
        now.getMilliseconds();
      let intervalId: ReturnType<typeof setInterval>;
      const timeoutId = setTimeout(() => {
        runDemoExpiry();
        intervalId = setInterval(runDemoExpiry, 3_600_000);
      }, msUntilNextHour);
      return () => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
      };
    }

    // 1. Delete expired Quick Bits (backend converts them to soft-deleted notes)
    authenticatedFetch("/api/quick-bits/expired", { method: "DELETE" })
      .then((r) => r.json())
      .then(({ count }: { count: number }) => {
        if (count > 0) setExpiredCount(count);
        queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
      })
      .catch(() => {});

    // 2. Immediate notification check
    runCheck();

    // 3. Schedule next check at the top of the next clock hour, then every hour
    const now = new Date();
    const msUntilNextHour =
      (60 - now.getMinutes()) * 60_000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds();

    let intervalId: ReturnType<typeof setInterval>;
    const timeoutId = setTimeout(() => {
      runCheck();
      intervalId = setInterval(runCheck, 3_600_000);
    }, msUntilNextHour);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [isDemo, runCheck, runDemoExpiry, queryClient]);

  const dismissNotification = (key: string) => {
    setNotifications((prev) => prev.filter((n) => n.key !== key));
  };

  // Nothing to render
  if (expiredCount === null && notifications.length === 0) return null;

  return (
    // flex-col-reverse: newest notification visually on top; expired banner at bottom
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-xs w-full pointer-events-none">
      {/* Expired banner */}
      {expiredCount !== null && (
        <div className="flex items-center gap-3 bg-panel border border-panel-border rounded-xl px-4 py-3 shadow-lg pointer-events-auto">
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm text-foreground flex-1">
            {expiredCount} Quick Bit{expiredCount !== 1 ? "s" : ""}{" "}
            expired and {expiredCount !== 1 ? "were" : "was"} removed.
          </span>
          <button
            onClick={() => setExpiredCount(null)}
            className="p-1 rounded hover:bg-panel-hover transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Notification cards */}
      {notifications.map((n) => {
        const expiry = formatExpiryLabel(n.expiresAt);
        return (
          <div
            key={n.key}
            className="flex items-start gap-3 bg-panel border border-panel-border rounded-xl px-4 py-3 shadow-lg hover:bg-panel-hover transition-colors cursor-pointer pointer-events-auto"
            onClick={() => {
              setFilter("quickbits");
              selectQuickBit(n.qbId);
              dismissNotification(n.key);
            }}
          >
            <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {n.title || "Untitled Quick Bit"}
              </p>
              <p className={`text-xs mt-0.5 ${expiry.className}`}>
                {expiry.label}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(n.key);
              }}
              className="p-1 rounded hover:bg-panel-hover transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
