import { useEffect } from "react";
import { Sidebar, SidebarContent } from "@/components/Sidebar";
import { NoteList } from "@/components/NoteList";
import { NoteEditor } from "@/components/NoteEditor";
import { AIPanel } from "@/components/AIPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { useAppStore } from "@/store";
import { useBreakpoint } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const { setSettingsOpen, isSidebarOpen, setSidebarOpen, mobileView, selectedNoteId } = useAppStore();
  const bp = useBreakpoint();

  useEffect(() => {
    if (bp === "desktop") return;
    setSidebarOpen(false);
  }, [bp]);

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
  const showEditor = bp === "desktop" || (bp === "tablet" && !!selectedNoteId) || (bp === "mobile" && mobileView === "editor");
  const showList = bp === "desktop" || bp === "tablet" || (bp === "mobile" && mobileView === "list");

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      {bp === "desktop" && <Sidebar />}

      {isCompact && (
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 z-40"
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                className="fixed inset-y-0 left-0 z-50 w-[280px] bg-panel border-r border-panel-border shadow-2xl"
              >
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {showList && <NoteList />}
      {showEditor && <NoteEditor />}

      <AIPanel />
      <SettingsModal />
    </div>
  );
}
