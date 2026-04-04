import { Zap, Plus, Clock, Menu, PanelLeft } from "lucide-react";
import { useAppStore } from "@/store";
import {
  useGetQuickBits,
  useCreateQuickBit,
  getGetQuickBitsQueryKey,
  getGetQuickBitQueryKey,
} from "@workspace/api-client-react";
import type { QuickBit } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { IconButton } from "./ui/IconButton";
import { useBreakpoint } from "@/hooks/use-mobile";
import { useDemoMode } from "@/lib/demo-context";
import { DEMO_QUICK_BITS } from "@/lib/demo-data";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "./ui/empty";

function formatExpiry(expiresAt: string): { label: string; className: string } {
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

export function QuickBitList() {
  const { setSidebarOpen, isSidebarOpen, toggleSidebar, selectedQuickBitId, selectQuickBit, setMobileView } = useAppStore();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const queryClient = useQueryClient();

  const queryParams = { sortBy: "expiresAt" as const, sortDir: "asc" as const };

  const { data: quickBitsData = [], isLoading: apiLoading } = useGetQuickBits(queryParams, {
    query: { enabled: !isDemo, queryKey: getGetQuickBitsQueryKey(queryParams) },
  });

  // In demo mode, read from individually-seeded caches (same pattern as NoteList)
  const demoQbQueries = useQueries({
    queries: isDemo
      ? DEMO_QUICK_BITS.map((qb) => ({
          queryKey: getGetQuickBitQueryKey(qb.id),
          queryFn: () => qb,
          initialData: qb,
          staleTime: Infinity,
          gcTime: Infinity,
          enabled: true,
        }))
      : [],
  });

  const quickBits: QuickBit[] = isDemo
    ? ([...new Map(
        demoQbQueries.map((q) => q.data).filter((d): d is QuickBit => !!d).map((qb) => [qb.id, qb])
      ).values()]).sort(
        (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
      )
    : (quickBitsData as QuickBit[]);
  const isLoading = isDemo ? false : apiLoading;

  const createMut = useCreateQuickBit({
    mutation: {
      onSuccess: (newQb) => {
        queryClient.invalidateQueries({ queryKey: getGetQuickBitsQueryKey() });
        selectQuickBit(newQb.id);
        if (bp === "mobile") setMobileView("editor");
      },
    },
  });

  const handleCreateNew = () => {
    if (isDemo) return;
    createMut.mutate({ data: { title: "", content: "" } });
  };

  const containerClass =
    bp === "mobile"
      ? "flex-1 bg-background flex flex-col h-screen"
      : cn(
          "border-r border-panel-border bg-background flex flex-col h-screen shrink-0 transition-all",
          bp === "tablet" ? "w-72" : "w-80",
        );

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="p-4 border-b border-panel-border flex flex-col gap-3">
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
            <h2 className="text-lg font-semibold tracking-tight truncate">Quick Bits</h2>
          </div>
          <IconButton
            onClick={handleCreateNew}
            disabled={createMut.isPending || isDemo}
            className="bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground shadow-sm"
            title="New Quick Bit"
          >
            <Plus className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quickBits.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Zap className="size-5" />
                </EmptyMedia>
                <EmptyTitle>No Quick Bits yet</EmptyTitle>
                <EmptyDescription>
                  Quick Bits are temporary notes that disappear after a few days — perfect for things you only need for a moment.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <button
                  onClick={handleCreateNew}
                  disabled={createMut.isPending || isDemo}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  New Quick Bit
                </button>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          quickBits.map((qb) => {
            const expiry = formatExpiry(qb.expiresAt);
            return (
              <div
                key={qb.id}
                onClick={() => { selectQuickBit(qb.id); if (bp === "mobile") setMobileView("editor"); }}
                className={cn(
                  "p-3 rounded-xl cursor-pointer border transition-all duration-200",
                  selectedQuickBitId === qb.id
                    ? "bg-panel border-primary/50 shadow-sm"
                    : "bg-transparent border-transparent hover:bg-panel hover:border-panel-border"
                )}
              >
                <h3 className="font-medium truncate text-sm mb-1 text-foreground/90">
                  {qb.title || "Untitled Quick Bit"}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                  {qb.contentText || "No content"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className={cn("text-[10px] font-mono", expiry.className)}>{expiry.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
