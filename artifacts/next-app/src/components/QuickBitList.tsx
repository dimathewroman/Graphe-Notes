import { useState, useRef, useEffect } from "react";
import { Zap, Plus, Clock, Menu, PanelLeft, Search, LayoutGrid, LayoutList, SortAsc } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationConfig } from "@/hooks/use-motion";
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
import { useDebounce } from "@/hooks/use-debounce";

const QB_SORT_OPTIONS = [
  { label: "Expires soonest", sortBy: "expiresAt" as const, sortDir: "asc" as const },
  { label: "Expires latest", sortBy: "expiresAt" as const, sortDir: "desc" as const },
  { label: "Date created (newest)", sortBy: "createdAt" as const, sortDir: "desc" as const },
  { label: "Date created (oldest)", sortBy: "createdAt" as const, sortDir: "asc" as const },
  { label: "Title (A → Z)", sortBy: "title" as const, sortDir: "asc" as const },
  { label: "Title (Z → A)", sortBy: "title" as const, sortDir: "desc" as const },
];

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
  const { setSidebarOpen, isSidebarOpen, toggleSidebar, selectedQuickBitId, selectQuickBit, setMobileView, viewMode, setViewMode, noteListWidth } = useAppStore();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const anim = useAnimationConfig();
  const queryClient = useQueryClient();

  const [qbSortBy, setQbSortBy] = useState<string>("expiresAt");
  const [qbSortDir, setQbSortDir] = useState<"asc" | "desc">("asc");
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebounce(localSearch, 300);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const allQuickBits: QuickBit[] = isDemo
    ? ([...new Map(
        demoQbQueries.map((q) => q.data).filter((d): d is QuickBit => !!d).map((qb) => [qb.id, qb])
      ).values()])
    : (quickBitsData as QuickBit[]);

  // Client-side search + sort
  const quickBits = allQuickBits
    .filter(qb => {
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return (qb.title?.toLowerCase().includes(q)) || (qb.contentText?.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      let cmp = 0;
      if (qbSortBy === "expiresAt") {
        cmp = new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      } else if (qbSortBy === "createdAt") {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (qbSortBy === "title") {
        cmp = (a.title || "").localeCompare(b.title || "");
      }
      return qbSortDir === "desc" ? -cmp : cmp;
    });

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
      : "border-r border-panel-border bg-background flex flex-col h-screen shrink-0";

  const containerWidth = bp === "mobile" ? undefined
    : viewMode === "gallery" ? 384
    : bp === "tablet" ? 288
    : noteListWidth;

  return (
    <div className={containerClass} style={containerWidth ? { width: containerWidth } : undefined}>
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
          <div className="flex items-center gap-1 shrink-0">
            <IconButton onClick={() => setViewMode(viewMode === "list" ? "gallery" : "list")} title={viewMode === "list" ? "Gallery view" : "List view"}>
              {viewMode === "list" ? <LayoutGrid className="w-4 h-4" /> : <LayoutList className="w-4 h-4" />}
            </IconButton>
            {/* Sort menu */}
            <div className="relative" ref={sortMenuRef}>
              <IconButton onClick={() => setShowSortMenu(!showSortMenu)} title="Sort" active={showSortMenu}>
                <SortAsc className="w-4 h-4" />
              </IconButton>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 z-40 min-w-[210px] bg-popover border border-panel-border rounded-lg shadow-xl py-1">
                  <p className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Sort by</p>
                  {QB_SORT_OPTIONS.map(opt => (
                    <button
                      key={`${opt.sortBy}-${opt.sortDir}`}
                      onClick={() => { setQbSortBy(opt.sortBy); setQbSortDir(opt.sortDir); setShowSortMenu(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors rounded-md",
                        qbSortBy === opt.sortBy && qbSortDir === opt.sortDir
                          ? "text-primary bg-primary/10"
                          : "text-foreground hover:bg-panel"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* New quick bit — rounded square, NOT circle */}
            <button
              onClick={handleCreateNew}
              disabled={createMut.isPending || isDemo}
              data-testid="new-quickbit-btn"
              className="p-2 rounded-[10px] bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search quick bits..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="w-full bg-panel border border-panel-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* List */}
      <div className={cn("flex-1 overflow-y-auto p-2", viewMode === "gallery" ? "grid grid-cols-2 gap-2 content-start" : "space-y-1")}>
        {isLoading ? (
          <div className={cn("flex justify-center", viewMode === "gallery" ? "col-span-2 p-4" : "p-4")}>
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quickBits.length === 0 ? (
          <div className={cn("p-8 text-center flex flex-col items-center justify-center text-muted-foreground", viewMode === "gallery" ? "col-span-2 h-full" : "h-full")}>
            {debouncedSearch ? (
              <>
                <Zap className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">No quick bits found.</p>
                <p className="text-xs mt-1 opacity-70">Try a different search term.</p>
              </>
            ) : (
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
            )}
          </div>
        ) : viewMode === "gallery" ? (
          <AnimatePresence initial={false}>
          {quickBits.map((qb) => {
            const expiry = formatExpiry(qb.expiresAt);
            return (
              <motion.div
                key={qb.id}
                data-testid="quickbit-item"
                layout
                initial={anim.initialVariants}
                animate={anim.enterVariants}
                exit={anim.exitVariants}
                transition={anim.fastTransition}
                onClick={() => { selectQuickBit(qb.id); if (bp === "mobile") setMobileView("editor"); }}
                className={cn(
                  "rounded-lg cursor-pointer border transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] group overflow-hidden min-h-[80px] hover:-translate-y-0.5 active:scale-[0.98]",
                  selectedQuickBitId === qb.id
                    ? "bg-primary/5 border-primary/30 shadow-sm"
                    : "bg-transparent border-transparent hover:bg-panel-hover hover:border-panel-border"
                )}
              >
                <div className="p-3">
                  <h3 className="font-medium text-sm text-foreground/90 truncate mb-1">
                    {qb.title || "Untitled Quick Bit"}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {qb.contentText || "No content"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                    <span className={cn("text-[10px] font-mono", expiry.className)}>{expiry.label}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        ) : (
          <AnimatePresence initial={false}>
          {quickBits.map((qb) => {
            const expiry = formatExpiry(qb.expiresAt);
            return (
              <motion.div
                key={qb.id}
                data-testid="quickbit-item"
                layout
                initial={anim.initialVariants}
                animate={anim.enterVariants}
                exit={anim.exitVariants}
                transition={anim.fastTransition}
                onClick={() => { selectQuickBit(qb.id); if (bp === "mobile") setMobileView("editor"); }}
                className={cn(
                  "p-3 rounded-lg cursor-pointer transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] group relative h-[88px] flex flex-col",
                  anim.useScale && "hover:-translate-y-[1px] active:scale-[0.98]",
                  selectedQuickBitId === qb.id
                    ? "bg-primary/5 border-l-2 border-l-primary border-y border-y-transparent border-r border-r-transparent"
                    : "border-l-2 border-l-transparent border-y border-y-transparent border-r border-r-transparent hover:bg-panel-hover"
                )}
              >
                <h3 className={cn(
                  "font-medium truncate pr-2 text-sm mb-1",
                  selectedQuickBitId === qb.id ? "text-foreground" : "text-foreground/90"
                )}>
                  {qb.title || "Untitled Quick Bit"}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                  {qb.contentText || "No content"}
                </p>
                <div className="flex items-center gap-1.5 mt-auto">
                  <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                  <span className={cn("text-[10px] font-mono", expiry.className)}>{expiry.label}</span>
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
