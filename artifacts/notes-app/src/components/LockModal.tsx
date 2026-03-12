import { useState } from "react";
import { Lock, Unlock, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface LockModalProps {
  mode: "set" | "verify";
  onConfirm: (hash: string) => void;
  onCancel: () => void;
  onUnlock?: () => void;
}

export function LockModal({ mode, onConfirm, onCancel, onUnlock }: LockModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError("Please enter a password."); return; }
    if (mode === "set" && password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    setLoading(true);
    const hash = await sha256(password);
    onConfirm(hash);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-popover border border-panel-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-panel text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{mode === "set" ? "Lock Note" : "Unlock Note"}</h2>
            <p className="text-xs text-muted-foreground">{mode === "set" ? "Set a password to protect this note" : "Enter the password to view this note"}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              autoFocus
              type={show ? "text" : "password"}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder={mode === "set" ? "New password" : "Password"}
              className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === "set" && (
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(""); }}
              placeholder="Confirm password"
              className="w-full bg-background border border-panel-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-panel-border text-sm text-muted-foreground hover:bg-panel hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {mode === "set" ? "Lock note" : "Unlock"}
            </button>
          </div>

          {mode === "verify" && onUnlock && (
            <button type="button" onClick={onUnlock} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Unlock className="w-3.5 h-3.5" />
              Remove lock entirely
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
