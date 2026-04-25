import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { X, ShieldCheck, Lock, KeyRound, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PinPad } from "./PinPad";
import {
  Dialog, DialogContent, DialogClose, DialogTitle,
} from "./ui/dialog";

interface VaultModalProps {
  mode: "setup" | "unlock" | "change-password";
  onConfirm: (pin: string, newPin?: string) => void;
  onCancel: () => void;
  error?: string;
  onVerifyCurrentPin?: (pin: string) => Promise<boolean>;
}

type PinStep = "enter" | "confirm" | "current" | "new" | "new-confirm";

export function VaultModal({ mode, onConfirm, onCancel, error: externalError, onVerifyCurrentPin }: VaultModalProps) {
  const [step, setStep] = useState<PinStep>(mode === "change-password" ? "current" : "enter");
  const [firstPin, setFirstPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  useEffect(() => {
    if (externalError) {
      setUnlockSuccess(false);
      setShakeKey(k => k + 1);
    }
  }, [externalError]);

  useEffect(() => {
    if (error) {
      setShakeKey(k => k + 1);
    }
  }, [error]);

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
      setUnlockSuccess(true);
      setTimeout(() => onConfirm(pin), 350);
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
        onConfirm(pin);
        return;
      }
    }

    if (mode === "change-password") {
      if (step === "current") {
        if (onVerifyCurrentPin) {
          const ok = await onVerifyCurrentPin(pin);
          if (!ok) {
            setError("Incorrect PIN. Please try again.");
            return;
          }
        }
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
        onConfirm(currentPin, pin);
        return;
      }
    }
  }, [mode, step, firstPin, currentPin, onConfirm, onVerifyCurrentPin]);

  const headerConfig = {
    setup: { icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />, bg: "bg-indigo-500/10 border-indigo-500/20", dotClass: "bg-indigo-500 border-indigo-500" },
    unlock: { icon: <Lock className="w-5 h-5 text-amber-500" />, bg: "bg-amber-500/10 border-amber-500/20", dotClass: "bg-amber-500 border-amber-500" },
    "change-password": { icon: <KeyRound className="w-5 h-5 text-amber-500" />, bg: "bg-amber-500/10 border-amber-500/20", dotClass: "bg-amber-500 border-amber-500" },
  }[mode];

  const { title, subtitle } = getStepInfo();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent
        data-testid="vault-modal"
        showCloseButton={false}
        aria-describedby={undefined}
        className="bg-popover border-panel-border rounded-2xl shadow-2xl max-w-sm p-6 backdrop-blur-sm"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogClose className="absolute top-4 right-4 p-1 rounded-lg hover:bg-panel text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </DialogClose>

        <div className="flex items-center gap-3 mb-5">
          <motion.div
            animate={unlockSuccess ? { scale: [1, 1.2, 1] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", unlockSuccess ? "bg-emerald-500/10 border-emerald-500/20" : headerConfig.bg)}
          >
            {unlockSuccess
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : headerConfig.icon}
          </motion.div>
          <div>
            <DialogTitle className="font-semibold text-foreground text-base">
              {unlockSuccess ? "Vault Unlocked" : mode === "setup" ? "Set Up Vault" : mode === "change-password" ? "Change Vault PIN" : "Unlock Vault"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              {unlockSuccess ? "Opening your notes…" : "Secure your notes with a PIN"}
            </p>
          </div>
        </div>

        {!unlockSuccess && (
          <PinPad
            key={step}
            title={title}
            subtitle={subtitle}
            error={displayError}
            shakeKey={shakeKey}
            filledDotClass={headerConfig.dotClass}
            onSubmit={handlePinSubmit}
            onCancel={onCancel}
            submitLabel={step === "confirm" || step === "new-confirm" ? "Confirm" : mode === "unlock" ? "Unlock" : "Next"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
