import { useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";
import dynamic from "next/dynamic";
import { Sidebar, SidebarContent } from "@/components/Sidebar";
import { NoteList } from "@/components/NoteList";
import { QuickBitList } from "@/components/QuickBitList";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
// Fix 4: lazy-load heavy editor bundles — TipTap alone is ~100KB+ gzipped
const NoteShell = dynamic(() => import("@/components/NoteShell").then(m => ({ default: m.NoteShell })), { ssr: false });
const QuickBitShell = dynamic(() => import("@/components/QuickBitShell").then(m => ({ default: m.QuickBitShell })), { ssr: false });
const SettingsModal = dynamic(() => import("@/components/SettingsModal").then(m => ({ default: m.SettingsModal })), { ssr: false });
import { RecentlyDeleted } from "@/components/RecentlyDeleted";
import { RecentlyDeletedDetail } from "@/components/RecentlyDeletedDetail";
import { AllAttachments } from "@/components/AllAttachments";
import { AIPanel } from "@/components/AIPanel";
import { AISetupModal } from "@/components/AISetupModal";
import { QuickBitNotifications } from "@/components/QuickBitNotifications";
import { useAppStore } from "@/store";
import { useBreakpoint } from "@/hooks/use-mobile";
import { useAnimationConfig } from "@/hooks/use-motion";
import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { DrawerPrimitive } from "@/components/ui/drawer-left";
import { useDemoMode } from "@/lib/demo-context";

// Mobile view stack animation variants — forward: list→editor, backward: editor→list
const mobileViewVariants = {
  enter: (dir: string) => ({
    x: dir === "forward" ? "30%" : "-10%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: string) => ({
    x: dir === "forward" ? "-10%" : "30%",
    opacity: 0,
  }),
};

export default function Home() {
  const { setSettingsOpen, isSidebarOpen, setSidebarOpen, isNoteListOpen, mobileView, selectedNoteId, selectedQuickBitId, activeFilter, noteListWidth, setNoteListWidth, viewMode } = useAppStore();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();
  const anim = useAnimationConfig();

  // Track mobile transition direction synchronously during render (not in effect)
  const prevMobileViewRef = useRef(mobileView);
  const mobileTransitionDirRef = useRef<"forward" | "backward">("forward");
  if (prevMobileViewRef.current !== mobileView) {
    mobileTransitionDirRef.current = mobileView === "editor" ? "forward" : "backward";
    prevMobileViewRef.current = mobileView;
  }

  // Desktop/tablet note list panel width — mirrors what each list component uses internally
  const listPanelWidth = viewMode === "gallery" ? 384 : bp === "tablet" ? 288 : noteListWidth;
  const panelSlideTransition = anim.level === "minimal"
    ? { duration: 0.1, ease: "linear" as const }
    : anim.standardTransition;

  const handleNoteListResize = useCallback((delta: number) => {
    setNoteListWidth(Math.min(600, Math.max(280, noteListWidth + delta)));
  }, [noteListWidth, setNoteListWidth]);

  useEffect(() => {
    if (bp === "desktop") {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [bp]);

  // Prevent iOS Safari from scrolling the page when the keyboard opens inside
  // the fixed sidebar drawer — which shifts the drawer position and doesn't
  // restore it after the keyboard dismisses.
  useEffect(() => {
    if (!isSidebarOpen || bp === "desktop") return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [isSidebarOpen, bp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSettingsOpen]);

  const isCompact = bp === "mobile" || bp === "tablet";
  const isRecentlyDeleted = activeFilter === "recently-deleted";
  const isAttachments = activeFilter === "attachments";
  // Fix 1: NoteShell stays mounted on tablet regardless of selection so the editor instance
  // persists across note switches — removing !!selectedNoteId prevents unmount/remount on each click.
  const showEditor = !isRecentlyDeleted && !isAttachments && activeFilter !== "quickbits" && (bp === "desktop" || bp === "tablet" || (bp === "mobile" && mobileView === "editor"));
  const showQuickBitEditor = activeFilter === "quickbits" && (bp === "desktop" || (bp === "tablet" && !!selectedQuickBitId) || (bp === "mobile" && mobileView === "editor"));
  const showList = bp === "desktop"
    ? isNoteListOpen
    : bp === "tablet"
      // On tablet the list is open by default but NoteShell may collapse it
      // (e.g. when the version history panel is open) by clearing the flag.
      ? isNoteListOpen
      : (bp === "mobile" && mobileView === "list");
  const showDeletedDetail = isRecentlyDeleted && !!selectedNoteId && (bp === "desktop" || (bp === "tablet" && !!selectedNoteId) || (bp === "mobile" && mobileView === "editor"));

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden relative">
      {isDemo && (
        <div className="w-full bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs text-primary z-50">
          <span>👋 You're in demo mode — notes won't be saved.</span>
          <a href="/" className="font-medium underline underline-offset-2 hover:opacity-80 transition-opacity">Sign up to keep your notes →</a>
        </div>
      )}
      <div className="flex flex-1 w-full overflow-hidden">
      {bp === "desktop" && <Sidebar />}

      {isCompact && (
        <Drawer
          open={isSidebarOpen}
          onOpenChange={(open) => {
            setSidebarOpen(open);
            try {
              posthog.capture("panel_toggled", {
                panel: "sidebar",
                action: open ? "open" : "close",
                timestamp: new Date().toISOString(),
              });
            } catch { /* PostHog may not be initialized */ }
          }}
          direction="left"
        >
          <DrawerPortal>
            <DrawerOverlay />
            <DrawerPrimitive
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-panel border-r border-panel-border shadow-2xl"
            >
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </DrawerPrimitive>
          </DrawerPortal>
        </Drawer>
      )}

      {bp === "mobile" ? (
        /* Mobile view stack — directional slide transition between list and editor */
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence custom={mobileTransitionDirRef.current}>
            <motion.div
              key={mobileView}
              custom={mobileTransitionDirRef.current}
              className="absolute inset-0 flex flex-col"
              variants={mobileViewVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={
                anim.level === "minimal"
                  ? { duration: 0.1, ease: "linear" as const }
                  : { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }
              }
              data-testid={`mobile-view-${mobileView}`}
            >
              {mobileView === "list" && (
                <>
                  {activeFilter === "quickbits" && <QuickBitList />}
                  {isRecentlyDeleted && <RecentlyDeleted />}
                  {isAttachments && <AllAttachments />}
                  {!isRecentlyDeleted && !isAttachments && activeFilter !== "quickbits" && <NoteList />}
                </>
              )}
              {mobileView === "editor" && (
                <>
                  {showEditor && <NoteShell />}
                  {showQuickBitEditor && <QuickBitShell />}
                  {showDeletedDetail && <RecentlyDeletedDetail />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* Desktop/tablet — note list panel with slide-in/out animation */
        <>
          <AnimatePresence initial={false}>
            {showList && (
              <motion.div
                key="list-panel"
                className="shrink-0 overflow-hidden"
                initial={{ width: 0 }}
                animate={{ width: listPanelWidth }}
                exit={{ width: 0 }}
                transition={panelSlideTransition}
                style={{ minWidth: 0 }}
                data-testid="note-list-panel"
              >
                <motion.div
                  style={{ width: listPanelWidth, minWidth: listPanelWidth }}
                  initial={{ x: -Math.round(listPanelWidth * 0.25), opacity: 0.5 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -Math.round(listPanelWidth * 0.25), opacity: 0.5 }}
                  transition={panelSlideTransition}
                >
                  {activeFilter === "quickbits" && <QuickBitList />}
                  {isRecentlyDeleted && <RecentlyDeleted />}
                  {!isRecentlyDeleted && !isAttachments && activeFilter !== "quickbits" && <NoteList />}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {isAttachments && <AllAttachments />}
          {bp === "desktop" && (showList || isAttachments) && <ResizeHandle onResize={handleNoteListResize} />}
          {showEditor && <NoteShell />}
          {showQuickBitEditor && <QuickBitShell />}
          {showDeletedDetail && <RecentlyDeletedDetail />}
        </>
      )}

      <AIPanel />
      <AISetupModal />
      <SettingsModal />
      <QuickBitNotifications />
      </div>
    </div>
  );
}
