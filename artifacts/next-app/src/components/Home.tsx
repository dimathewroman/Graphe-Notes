import { useEffect, useCallback } from "react";
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
import { Drawer, DrawerPortal, DrawerOverlay } from "@/components/ui/drawer";
import { DrawerPrimitive } from "@/components/ui/drawer-left";
import { useDemoMode } from "@/lib/demo-context";

export default function Home() {
  const { setSettingsOpen, isSidebarOpen, setSidebarOpen, isNoteListOpen, mobileView, selectedNoteId, selectedQuickBitId, activeFilter, noteListWidth, setNoteListWidth } = useAppStore();
  const bp = useBreakpoint();
  const isDemo = useDemoMode();

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
  const showList = bp === "desktop" ? isNoteListOpen : (bp === "tablet" || (bp === "mobile" && mobileView === "list"));
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
          onOpenChange={setSidebarOpen}
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

      {showList && activeFilter === "quickbits" && <QuickBitList />}
      {showList && isRecentlyDeleted && <RecentlyDeleted />}
      {isAttachments && <AllAttachments />}
      {showList && !isRecentlyDeleted && !isAttachments && activeFilter !== "quickbits" && <NoteList />}
      {bp === "desktop" && (showList || isAttachments) && <ResizeHandle onResize={handleNoteListResize} />}
      {showEditor && <NoteShell />}
      {showQuickBitEditor && <QuickBitShell />}
      {showDeletedDetail && <RecentlyDeletedDetail />}

      <AIPanel />
      <AISetupModal />
      <SettingsModal />
      <QuickBitNotifications />
      </div>
    </div>
  );
}
