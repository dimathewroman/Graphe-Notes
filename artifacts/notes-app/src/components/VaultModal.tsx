import { useState, useCallback } from "react";
import { X, ShieldCheck, Lock, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PinPad } from "./PinPad";

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

type PinStep = "enter" | "confirm" | "current" | "new" | "new-confirm";

export function VaultModal({ mode, onConfirm, onCancel, error: externalError }: VaultModalProps) {
  const [step, setStep] = useState<PinStep>(mode === "change-password" ? "current" : "enter");
  const [firstPin, setFirstPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");

  const displayError = externalError || error;

  const getStepInfo = (): { title: string; subtitle: string } => {
    switch (step) {
      case "enter":
        return mode === "setup"
          ? { title: "Create Vault PIN", subtitle: "Enter a 4–6 digit PIN" }
          : { title: "Unlock Vault", subtitle: "Enter your PIN to access vault notes" };
      case "confirm":
        return { title: "Confirm PIN", subtitle: "Re-enter your PIN to confirm" };
      case "current":
        return { title: "Current PIN", subtitle: "Enter your current vault PIN" };
      case "new":
        return { title: "New PIN", subtitle: "Enter a new 4–6 digit PIN" };
      case "new-confirm":
        return { title: "Confirm New PIN", subtitle: "Re-enter your new PIN" };
    }
  };

  const handlePinSubmit = useCallback(async (pin: string) => {
    setError("");

    if (mode === "unlock") {
      const hash = await sha256(pin);
      onConfirm(hash);
      return;
    }

    if (mode === "setup") {
      if (step === "enter") {
        setFirstPin(pin);
        setStep("confirm");
        return;
      }
      if (step === "confirm") {
        if (pin !== firstPin) {
          setError("PINs don't match. Try again.");
          setFirstPin("");
          setStep("enter");
          return;
        }
        const hash = await sha256(pin);
        onConfirm(hash);
        return;
      }
    }

    if (mode === "change-password") {
      if (step === "current") {
        setCurrentPin(pin);
        setStep("new");
        return;
      }
      if (step === "new") {
        setFirstPin(pin);
        setStep("new-confirm");
        return;
      }
      if (step === "new-confirm") {
        if (pin !== firstPin) {
          setError("PINs don't match. Try again.");
          setFirstPin("");
          setStep("new");
          return;
        }
        const currentHash = await sha256(currentPin);
        const newHash = await sha256(pin);
        onConfirm(currentHash, newHash);
        return;
      }
    }
  }, [mode, step, firstPin, currentPin, onConfirm]);

  const headerConfig = {
    setup: { icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />, bg: "bg-indigo-500/10 border-indigo-500/20" },
    unlock: { icon: <Lock className="w-5 h-5 text-amber-500" />, bg: "bg-amber-500/10 border-amber-500/20" },
    "change-password": { icon: <KeyRound className="w-5 h-5 text-amber-500" />, bg: "bg-amber-500/10 border-amber-500/20" },
  }[mode];

  const { title, subtitle } = getStepInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-popover border border-panel-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-panel text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", headerConfig.bg)}>
            {headerConfig.icon}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">
              {mode === "setup" ? "Set Up Vault" : mode === "change-password" ? "Change Vault PIN" : "Unlock Vault"}
            </h2>
            <p className="text-xs text-muted-foreground">Secure your notes with a PIN</p>
          </div>
        </div>

        <PinPad
          title={title}
          subtitle={subtitle}
          error={displayError}
          onSubmit={handlePinSubmit}
          onCancel={onCancel}
          submitLabel={step === "confirm" || step === "new-confirm" ? "Confirm" : mode === "unlock" ? "Unlock" : "Next"}
        />
      </div>
    </div>
  );
}
