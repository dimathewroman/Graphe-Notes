import { useState } from "react";
import { Lock, Eye, EyeOff, X, ShieldCheck, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface VaultModalProps {
  mode: "setup" | "unlock" | "change-password";
  onConfirm: (hash: string, newHash?: string) => void;
  onCancel: () => void;
  error?: string;
}

export function VaultModal({ mode, onConfirm, onCancel, error: externalError }: VaultModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const displayError = externalError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError("Please enter a password."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }

    if (mode === "setup" && password !== confirm) { setError("Passwords don't match."); return; }

    if (mode === "change-password") {
      if (!newPassword) { setError("Please enter a new password."); return; }
      if (newPassword.length < 4) { setError("New password must be at least 4 characters."); return; }
      if (newPassword !== newConfirm) { setError("New passwords don't match."); return; }
      setLoading(true);
      const currentHash = await sha256(password);
      const newHash = await sha256(newPassword);
      onConfirm(currentHash, newHash);
      setLoading(false);
      return;
    }

    setLoading(true);
    const hash = await sha256(password);
    onConfirm(hash);
    setLoading(false);
  };

  const titles = {
    setup: { title: "Set Up Vault", subtitle: "Create a password to protect your vault notes" },
    unlock: { title: "Unlock Vault", subtitle: "Enter your password to access vault notes" },
    "change-password": { title: "Change Vault Password", subtitle: "Enter current and new passwords" },
  };

  const { title, subtitle } = titles[mode];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-popover border border-panel-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-panel text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border",
            mode === "setup" ? "bg-indigo-500/10 border-indigo-500/20" : "bg-amber-500/10 border-amber-500/20"
          )}>
            {mode === "setup" ? <ShieldCheck className="w-5 h-5 text-indigo-500" /> :
             mode === "change-password" ? <KeyRound className="w-5 h-5 text-amber-500" /> :
             <Lock className="w-5 h-5 text-amber-500" />}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              autoFocus
              type={show ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder={mode === "change-password" ? "Current password" : "Password"}
              className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === "setup" && (
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
              placeholder="Confirm password"
              className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          )}

          {mode === "change-password" && (
            <>
              <div className="w-full h-px bg-panel-border my-2" />
              <input
                type={show ? "text" : "password"}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError(""); }}
                placeholder="New password"
                className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
              <input
                type={show ? "text" : "password"}
                value={newConfirm}
                onChange={e => { setNewConfirm(e.target.value); setError(""); }}
                placeholder="Confirm new password"
                className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              />
            </>
          )}

          {displayError && <p className="text-xs text-destructive">{displayError}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-panel-border text-sm text-muted-foreground hover:bg-panel hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50",
                mode === "setup" ? "bg-indigo-500 hover:bg-indigo-600" : "bg-amber-500 hover:bg-amber-600"
              )}
            >
              {mode === "setup" ? "Set Up Vault" : mode === "change-password" ? "Change Password" : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
