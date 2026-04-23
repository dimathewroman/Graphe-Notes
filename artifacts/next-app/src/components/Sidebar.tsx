import { useState, useEffect } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import { useAnimationConfig } from "@/hooks/use-motion";
const grapheLogo = "/graphe_minimalist_1773640203523.png";
import {
  Folder, FolderOpen, FileText, Star, Sun, Moon,
  Settings, Hash, Plus, Trash2, Paperclip, Edit2, Zap, Tag, Menu, X, ShieldCheck, Lock, Unlock, KeyRound, LogOut, Wand2
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import {
  useGetFolders, useCreateFolder, useDeleteFolder, getGetFoldersQueryKey, useGetTags,
  useGetVaultStatus, useSetupVault, useUnlockVault, useChangeVaultPassword,
} from "@workspace/api-client-react";
import { VaultModal } from "./VaultModal";
import { useQueryClient } from "@tanstack/react-query";
import { IconButton } from "./ui/IconButton";
import { useDemoMode } from "@/lib/demo-context";
import { FolderEditModal } from "./FolderEditModal";
import { useBreakpoint } from "@/hooks/use-mobile";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const {
    activeFilter, activeFolderId, activeTag, setFilter,
    setSettingsOpen, setAIPanelOpen,
    isVaultUnlocked, setVaultUnlocked,
  } = useAppStore();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();

  const { data: foldersData, isLoading: foldersLoading } = useGetFolders();
  const folders = Array.isArray(foldersData) ? foldersData : [];
  const { data: tagsData } = useGetTags();
  const tags = Array.isArray(tagsData) ? tagsData : [];

  const createFolderMut = useCreateFolder({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() }) }
  });
  const deleteFolderMut = useDeleteFolder({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetFoldersQueryKey() }) }
  });

  const { data: vaultStatus } = useGetVaultStatus();
  const setupVaultMut = useSetupVault();
  const unlockVaultMut = useUnlockVault();
  const changePasswordMut = useChangeVaultPassword();

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return !document.documentElement.classList.contains("light");
  });
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    if (next === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("theme_mode", next);
    setIsDark(next === "dark");
  };

  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null>(null);
  const [editingFolder, setEditingFolder] = useState<typeof folders[0] | null>(null);
  const [vaultModal, setVaultModal] = useState<"setup" | "unlock" | "change-password" | null>(null);
  const [vaultError, setVaultError] = useState("");

  const toggleFolder = (id: number) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedFolders(next);
  };

  // Auto-expand ancestor folders when the active filter is a subfolder so the
  // active item stays visible after navigation (e.g. mobile drawer close/reopen
  // resets component state, losing expanded state for the parent folder).
  useEffect(() => {
    if (activeFilter !== "folder" || !activeFolderId || folders.length === 0) return;
    const toExpand = new Set<number>();
    let current = folders.find(f => f.id === activeFolderId);
    while (current?.parentId) {
      toExpand.add(current.parentId);
      current = folders.find(f => f.id === current!.parentId);
    }
    if (toExpand.size === 0) return;
    setExpandedFolders(prev => {
      const next = new Set(prev);
      toExpand.forEach(id => next.add(id));
      return next;
    });
  }, [activeFilter, activeFolderId, folders]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    (document.activeElement as HTMLElement)?.blur();
    if (isDemo) {
      // In demo mode, add folder directly to the cache (ephemeral)
      const tempId = -(Date.now());
      const newFolder = {
        id: tempId, name: newFolderName.trim(), sortOrder: folders.length,
        parentId: newFolderParentId, tagRules: [], createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(["/api/folders"], [...folders, newFolder]);
      setNewFolderName(""); setIsCreatingFolder(false); setNewFolderParentId(null);
      return;
    }
    await createFolderMut.mutateAsync({ data: { name: newFolderName, sortOrder: folders.length, parentId: newFolderParentId } });
    posthog.capture("folder_created", { parent_folder_id: newFolderParentId });
    setNewFolderName(""); setIsCreatingFolder(false); setNewFolderParentId(null);
  };

  const handleNavClick = (filter: "all" | "favorites" | "attachments" | "folder" | "tag" | "vault" | "quickbits", idOrTag?: number | string | null) => {
    setFilter(filter, idOrTag);
    onNavigate?.();
  };

  const DEMO_VAULT_KEY = "demo_vault_hash";

  const handleVaultClick = () => {
    const isConfigured = isDemo
      ? !!sessionStorage.getItem(DEMO_VAULT_KEY)
      : vaultStatus?.isConfigured;
    if (!isConfigured) {
      setVaultModal("setup");
    } else if (!isVaultUnlocked) {
      setVaultModal("unlock");
    } else {
      handleNavClick("vault");
    }
  };

  const handleVaultConfirm = async (hash: string, newHash?: string) => {
    setVaultError("");
    if (isDemo) {
      if (vaultModal === "setup") {
        sessionStorage.setItem(DEMO_VAULT_KEY, hash);
        queryClient.setQueryData(["/api/vault/status"], { isConfigured: true });
        setVaultUnlocked(true);
        setVaultModal(null);
      } else if (vaultModal === "unlock") {
        const stored = sessionStorage.getItem(DEMO_VAULT_KEY);
        if (stored && stored === hash) {
          setVaultUnlocked(true);
          setVaultModal(null);
        } else {
          setVaultError("Wrong PIN.");
        }
      } else if (vaultModal === "change-password" && newHash) {
        const stored = sessionStorage.getItem(DEMO_VAULT_KEY);
        if (stored && stored === hash) {
          sessionStorage.setItem(DEMO_VAULT_KEY, newHash);
          setVaultModal(null);
        } else {
          setVaultError("Wrong current PIN.");
        }
      }
      return;
    }
    try {
      if (vaultModal === "setup") {
        await setupVaultMut.mutateAsync({ data: { passwordHash: hash } });
        setVaultUnlocked(true);
        setVaultModal(null);
        queryClient.invalidateQueries({ queryKey: ["/api/vault/status"] });
      } else if (vaultModal === "unlock") {
        await unlockVaultMut.mutateAsync({ data: { passwordHash: hash } });
        setVaultUnlocked(true);
        setVaultModal(null);
      } else if (vaultModal === "change-password" && newHash) {
        await changePasswordMut.mutateAsync({ data: { currentPasswordHash: hash, newPasswordHash: newHash } });
        setVaultModal(null);
      }
    } catch {
      setVaultError(vaultModal === "unlock" ? "Wrong PIN." : vaultModal === "change-password" ? "Wrong current PIN." : "Failed to set up vault.");
    }
  };

  const handleVaultLock = () => {
    setVaultUnlocked(false);
    if (activeFilter === "vault") {
      setFilter("all");
    }
  };

  const rootFolders = folders.filter(f => !f.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const renderFolder = (folder: typeof folders[0], depth: number = 0) => {
    const children = folders.filter(f => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
    const isExpanded = expandedFolders.has(folder.id);
    const isActive = activeFilter === "folder" && activeFolderId === folder.id;
    const isSmart = folder.tagRules && folder.tagRules.length > 0;

    return (
      <div key={folder.id}>
        <div
          className={cn(
            "group flex items-center justify-between py-2 md:py-1.5 rounded-lg cursor-pointer transition-colors",
            isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
          )}
          style={{ paddingLeft: `${depth * 12 + 22}px`, paddingRight: "12px" }}
          onClick={() => handleNavClick("folder", folder.id)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              className="p-1 md:p-0.5 hover:bg-panel rounded-md opacity-60 hover:opacity-100 shrink-0"
              onClick={e => { e.stopPropagation(); toggleFolder(folder.id); }}
            >
              {children.length > 0 ? (
                isExpanded ? <FolderOpen className="w-4 h-4" style={folder.color ? { color: folder.color } : undefined} /> : <Folder className="w-4 h-4" style={folder.color ? { color: folder.color } : undefined} />
              ) : (
                isSmart
                  ? <Tag className="w-4 h-4 text-primary/60" />
                  : <Folder className="w-4 h-4 opacity-50" style={folder.color ? { color: folder.color, opacity: 1 } : undefined} />
              )}
            </button>
            <span className="text-sm truncate">{folder.name}</span>
            {isSmart && (
              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                smart
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              className="p-1.5 md:p-1 hover:bg-panel rounded-md transition-colors"
              onClick={e => { e.stopPropagation(); setEditingFolder(folder); }}
              title="Edit folder"
            >
              <Edit2 className="w-3.5 h-3.5 md:w-3 md:h-3 text-muted-foreground" />
            </button>
            <button
              className="p-1.5 md:p-1 hover:bg-panel rounded-md transition-colors"
              onClick={e => {
                e.stopPropagation();
                setNewFolderParentId(folder.id);
                setIsCreatingFolder(true);
                const next = new Set(expandedFolders);
                next.add(folder.id);
                setExpandedFolders(next);
              }}
              title="Add subfolder"
            >
              <Plus className="w-3.5 h-3.5 md:w-3 md:h-3 text-muted-foreground" />
            </button>
            <button
              className="p-1.5 md:p-1 hover:bg-panel rounded-md transition-colors"
              onClick={e => {
                e.stopPropagation();
                if (confirm(`Delete folder "${folder.name}"?`)) {
                  if (isDemo) {
                    queryClient.setQueryData(["/api/folders"], folders.filter(f => f.id !== folder.id));
                  } else {
                    deleteFolderMut.mutate({ id: folder.id });
                  }
                  if (isActive) handleNavClick("all");
                }
              }}
              title="Delete folder"
            >
              <Trash2 className="w-3.5 h-3.5 md:w-3 md:h-3 text-destructive" />
            </button>
          </div>
        </div>


        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
        {isExpanded && isCreatingFolder && newFolderParentId === folder.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 12 + 22}px`, paddingRight: "12px" }} className="mb-1">
            <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-background border border-panel-border rounded-lg px-2 py-1">
              <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateFolder(e as any); } }}
                onBlur={() => { if (!newFolderName) { setIsCreatingFolder(false); setNewFolderParentId(null); } }}
                placeholder="Subfolder name..."
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              />
            </form>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo + Settings */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <img src={grapheLogo} alt="Graphe Notes" className="w-6 h-6 rounded-md" />
          <span>Graphe Notes</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </IconButton>
          <IconButton onClick={() => { setSettingsOpen(true); onNavigate?.(); }}>
            <Settings className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* Primary nav */}
        <div className="px-3 space-y-0.5 mb-3">
          <NavItem icon={<FileText className="w-4 h-4" />} label="All Notes" active={activeFilter === "all"} onClick={() => handleNavClick("all")} testId="nav-all-notes" />
          <NavItem icon={<Zap className="w-4 h-4" />} label="Quick Bits" active={activeFilter === "quickbits"} onClick={() => handleNavClick("quickbits")} testId="nav-quickbits" />
          <NavItem icon={<Star className="w-4 h-4" />} label="Favorites" active={activeFilter === "favorites"} onClick={() => handleNavClick("favorites")} />
          <NavItem icon={<Paperclip className="w-4 h-4" />} label="Attachments" active={activeFilter === "attachments"} onClick={() => handleNavClick("attachments")} />
          {/* Vault — in main nav after Attachments */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleVaultClick}
              data-testid="nav-vault"
              className={cn(
                "flex-1 flex items-center gap-3 px-3 py-2.5 md:py-2 rounded-lg text-sm",
                "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]",
                "active:scale-[0.97]",
                activeFilter === "vault" && isVaultUnlocked
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
              )}
            >
              <ShieldCheck className={cn("w-4 h-4", isVaultUnlocked && "text-indigo-400")} />
              <span>Vault</span>
              {!vaultStatus?.isConfigured && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-panel border border-panel-border text-muted-foreground">new</span>
              )}
              {vaultStatus?.isConfigured && !isVaultUnlocked && (
                <Lock className="ml-auto w-3 h-3 text-muted-foreground" />
              )}
            </button>
            {isVaultUnlocked && (
              <div className="flex items-center gap-0.5">
                <IconButton onClick={handleVaultLock} title="Lock vault">
                  <Lock className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton onClick={() => setVaultModal("change-password")} title="Change vault password">
                  <KeyRound className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            )}
          </div>
        </div>

        <div className="mx-3 border-t border-panel-border mb-3" />

        {/* Folders */}
        <div className="pl-6 pr-4 mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Folders</span>
          <IconButton
            onClick={() => { setNewFolderParentId(null); setIsCreatingFolder(true); }}
            title="New folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </IconButton>
        </div>

        {isCreatingFolder && newFolderParentId === null && (
          <div className="px-3 mb-2">
            <form onSubmit={handleCreateFolder} className="flex items-center gap-2 bg-background border border-panel-border rounded-lg px-2 py-1">
              <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateFolder(e as any); } }}
                onBlur={() => { if (!newFolderName) setIsCreatingFolder(false); }}
                placeholder="Folder name..."
                className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
              />
            </form>
          </div>
        )}

        <div className="space-y-0 mb-3">
          {foldersLoading ? (
            <div className="px-6 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : rootFolders.length === 0 ? (
            <div className="px-6 py-2 text-xs text-muted-foreground italic">No folders yet</div>
          ) : (
            rootFolders.map(f => renderFolder(f))
          )}
        </div>

        <div className="mx-3 border-t border-panel-border mb-3" />

        {/* Recently Deleted — below Folders */}
        <div className="px-3 space-y-0.5 mb-3">
          <NavItem
            icon={<Trash2 className="w-4 h-4 text-muted-foreground" />}
            label="Recently Deleted"
            active={activeFilter === "recently-deleted"}
            onClick={() => { setFilter("recently-deleted"); onNavigate?.(); }}
          />
        </div>

      </div>

      {/* AI Assistant — directly above profile */}
      <div className="px-3 py-2">
        <button
          onClick={() => { setAIPanelOpen(true); onNavigate?.(); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 md:py-2 rounded-xl bg-accent-gradient text-white font-medium hover:opacity-90 transition-opacity shadow-sm"
        >
          <Wand2 className="w-4 h-4" />
          <span>AI Assistant</span>
        </button>
      </div>

      {/* Bottom section: Profile */}
      <div className="p-3 border-t border-panel-border">
        {user && (
          <div className="flex items-center gap-2 px-1">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">
                {(user.firstName?.[0] ?? user.email?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <span className="flex-1 text-xs text-muted-foreground truncate">
              {user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : (user.email ?? "User")}
            </span>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-panel-hover transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {editingFolder && (
        <FolderEditModal
          folder={editingFolder}
          onClose={() => setEditingFolder(null)}
        />
      )}

      {vaultModal && (
        <VaultModal
          mode={vaultModal}
          onConfirm={handleVaultConfirm}
          onCancel={() => { setVaultModal(null); setVaultError(""); }}
          error={vaultError}
          onVerifyCurrentPin={vaultModal === "change-password" ? async (hash) => {
            try {
              await unlockVaultMut.mutateAsync({ data: { passwordHash: hash } });
              return true;
            } catch {
              return false;
            }
          } : undefined}
        />
      )}
    </div>
  );
}

export function Sidebar() {
  const { isSidebarOpen, sidebarWidth } = useAppStore();
  const bp = useBreakpoint();
  const anim = useAnimationConfig();

  if (bp !== "desktop") return null;

  const w = sidebarWidth; // 240 by default
  const slideTransition = anim.level === "minimal"
    ? { duration: 0.1, ease: "linear" as const }
    : anim.standardTransition;

  return (
    <AnimatePresence initial={false}>
      {isSidebarOpen && (
        <motion.div
          key="desktop-sidebar"
          // Outer wrapper: animates layout width so flex siblings reflow smoothly
          className="shrink-0 overflow-hidden border-r border-panel-border bg-panel"
          initial={{ width: 0 }}
          animate={{ width: w }}
          exit={{ width: 0 }}
          transition={slideTransition}
          style={{ minWidth: 0 }}
          data-testid="sidebar"
        >
          {/* Inner div stays full-width — clipped by overflow-hidden during animation */}
          <motion.div
            className="flex flex-col h-full"
            style={{ width: w, minWidth: w }}
            initial={{ x: -w, opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -w, opacity: 0.5 }}
            transition={slideTransition}
          >
            <SidebarContent />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NavItem({ icon, label, active, onClick, testId }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; testId?: string }) {
  const anim = useAnimationConfig();
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "w-full flex items-center gap-3 py-2.5 md:py-2 px-3 rounded-lg text-sm relative",
        "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]",
        "active:scale-[0.97]",
        active ? "text-primary font-medium" : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
      )}
    >
      {active && (
        <motion.div
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-lg bg-primary/10"
          initial={false}
          transition={anim.level === "full"
            ? { type: "spring", stiffness: 380, damping: 30 }
            : anim.standardTransition
          }
        />
      )}
      <span className="relative z-10 shrink-0">{icon}</span>
      <span className="relative z-10">{label}</span>
    </button>
  );
}
