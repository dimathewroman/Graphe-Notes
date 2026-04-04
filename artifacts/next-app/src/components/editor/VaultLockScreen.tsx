// Screen shown when the selected note is vaulted and the vault is locked.

import { ArrowLeft, PanelLeft, PanelLeftClose, ShieldCheck } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { VaultModal } from "@/components/VaultModal";

export function VaultLockScreen({
  bp,
  isSidebarOpen,
  isNoteListOpen,
  onToggleSidebar,
  onToggleNoteList,
  onBack,
  showVaultUnlockModal,
  onRequestUnlock,
  onUnlockConfirm,
  onUnlockCancel,
  vaultUnlockError,
}: {
  bp: "mobile" | "tablet" | "desktop";
  isSidebarOpen: boolean;
  isNoteListOpen: boolean;
  onToggleSidebar: () => void;
  onToggleNoteList: () => void;
  onBack: () => void;
  showVaultUnlockModal: boolean;
  onRequestUnlock: () => void;
  onUnlockConfirm: (hash: string) => Promise<void>;
  onUnlockCancel: () => void;
  vaultUnlockError: string;
}) {
  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="h-14 border-b border-panel-border flex items-center px-2 gap-1 bg-background/80 backdrop-blur-md shrink-0">
        {bp === "mobile" && (
          <button onClick={onBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
        {bp === "desktop" && !isSidebarOpen && (
          <IconButton onClick={onToggleSidebar} title="Show sidebar">
            <PanelLeft className="w-4 h-4" />
          </IconButton>
        )}
        {bp === "desktop" && !isNoteListOpen && (
          <IconButton onClick={onToggleNoteList} title="Show note list">
            <PanelLeftClose className="w-4 h-4 scale-x-[-1]" />
          </IconButton>
        )}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-medium text-foreground/80">This note is in the vault</h2>
        <p className="text-sm text-center max-w-xs">Unlock the vault to view this note.</p>
        <button
          onClick={onRequestUnlock}
          className="mt-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
        >
          Unlock Vault
        </button>
      </div>
      {showVaultUnlockModal && (
        <VaultModal
          mode="unlock"
          onConfirm={onUnlockConfirm}
          onCancel={onUnlockCancel}
          error={vaultUnlockError}
        />
      )}
    </div>
  );
}
