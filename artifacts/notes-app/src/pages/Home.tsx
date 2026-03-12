import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { NoteList } from "@/components/NoteList";
import { NoteEditor } from "@/components/NoteEditor";
import { AIPanel } from "@/components/AIPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { useAppStore } from "@/store";

export default function Home() {
  const { setSettingsOpen, setSearchQuery } = useAppStore();

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K -> Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      
      // Ctrl/Cmd + , -> Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSettingsOpen]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <Sidebar />
      <NoteList />
      <NoteEditor />
      <AIPanel />
      <SettingsModal />
    </div>
  );
}
