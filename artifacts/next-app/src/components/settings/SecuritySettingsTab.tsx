import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { PinPad } from "../PinPad";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";

export function SecuritySettingsTab({ isDemo }: { isDemo: boolean }) {
  const isSettingsOpen = useAppStore(s => s.isSettingsOpen);

  // Security / vault state
  const [vaultConfigured, setVaultConfigured] = useState(false);
  const [securityMode, setSecurityMode] = useState<"idle" | "setup" | "reset">("idle");
  const [securityStep, setSecurityStep] = useState<"current" | "new" | "confirm">("current");
  const [securityFirstPin, setSecurityFirstPin] = useState("");
  const [securityCurrentPin, setSecurityCurrentPin] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);

  // ── Load vault status on open ───────────────────────────────────
  // This component only mounts when the Security tab is active, so we run on
  // open (isSettingsOpen) rather than gating on the active tab.
  useEffect(() => {
    if (isSettingsOpen) {
      if (isDemo) {
        // X-D3: demo vault state is the sessionStorage PIN hash (source of truth).
        setVaultConfigured(!!sessionStorage.getItem("demo_vault_hash"));
      } else {
        authenticatedFetch("/api/vault/status")
          .then(r => r.json())
          .then((data: { isConfigured: boolean }) => setVaultConfigured(data.isConfigured))
          .catch(() => {});
      }
      setSecurityMode("idle");
      setSecurityStep("current");
      setSecurityFirstPin("");
      setSecurityCurrentPin("");
      setSecurityError("");
    }
  }, [isSettingsOpen, isDemo]);

  // ── Security handlers ────────────────────────────────────────────
  const handleSecurityPinSubmit = useCallback(async (pin: string) => {
    setSecurityError("");
    setSecurityLoading(true);

    try {
      if (securityMode === "setup") {
        if (securityStep === "new") {
          setSecurityFirstPin(pin);
          setSecurityStep("confirm");
          setSecurityLoading(false);
          return;
        }
        if (securityStep === "confirm") {
          if (pin !== securityFirstPin) {
            setSecurityError("PINs don't match. Try again.");
            setSecurityFirstPin("");
            setSecurityStep("new");
            setSecurityLoading(false);
            return;
          }
          if (isDemo) {
            // X-D3/D4: demo vault is client-only — the PIN lives in sessionStorage
            // (the same key NoteShell/Sidebar read), no authenticated request.
            sessionStorage.setItem("demo_vault_hash", pin);
          } else {
            // Send plaintext PIN — hashing happens server-side with bcrypt
            const res = await authenticatedFetch("/api/vault/setup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
            });
            if (!res.ok) throw new Error("Setup failed");
          }
          setVaultConfigured(true);
          setSecurityMode("idle");
        }
      }

      if (securityMode === "reset") {
        if (securityStep === "current") {
          // Verify the current PIN immediately — don't let the user type their new
          // PIN only to find out the current one was wrong.
          if (isDemo) {
            // X-D4: compare against the sessionStorage PIN (source of truth).
            const stored = sessionStorage.getItem("demo_vault_hash");
            if (stored && stored !== pin) {
              setSecurityError("Incorrect PIN. Please try again.");
              setSecurityLoading(false);
              return;
            }
          } else {
            const verifyRes = await authenticatedFetch("/api/vault/unlock", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pin }),
            });
            if (!verifyRes.ok) {
              setSecurityError("Incorrect PIN. Please try again.");
              setSecurityLoading(false);
              return;
            }
          }
          // Store the plaintext PIN so we can send it in the change-password call.
          setSecurityCurrentPin(pin);
          setSecurityStep("new");
          setSecurityLoading(false);
          return;
        }
        if (securityStep === "new") {
          setSecurityFirstPin(pin);
          setSecurityStep("confirm");
          setSecurityLoading(false);
          return;
        }
        if (securityStep === "confirm") {
          if (pin !== securityFirstPin) {
            setSecurityError("PINs don't match. Try again.");
            setSecurityFirstPin("");
            setSecurityStep("new");
            setSecurityLoading(false);
            return;
          }
          if (isDemo) {
            // X-D4: rotate the sessionStorage PIN, no authenticated request.
            sessionStorage.setItem("demo_vault_hash", pin);
          } else {
            // Send plaintext PINs — hashing happens server-side with bcrypt
            const res = await authenticatedFetch("/api/vault/change-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPin: securityCurrentPin, newPin: pin }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error((data as { error?: string }).error || "Failed to change PIN");
            }
          }
          setSecurityMode("idle");
        }
      }
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSecurityLoading(false);
    }
  }, [securityMode, securityStep, securityFirstPin, securityCurrentPin, isDemo]);

  const getSecurityStepInfo = () => {
    if (securityMode === "setup") {
      if (securityStep === "new") return { title: "Create Vault PIN", subtitle: "Enter a 4–6 digit PIN" };
      if (securityStep === "confirm") return { title: "Confirm PIN", subtitle: "Re-enter your PIN to confirm" };
    }
    if (securityMode === "reset") {
      if (securityStep === "current") return { title: "Current PIN", subtitle: "Enter your current vault PIN" };
      if (securityStep === "new") return { title: "New PIN", subtitle: "Enter a new 4–6 digit PIN" };
      if (securityStep === "confirm") return { title: "Confirm New PIN", subtitle: "Re-enter your new PIN" };
    }
    return { title: "", subtitle: "" };
  };

  return (
    <section className="space-y-4">
      {securityMode === "idle" ? (
        <>
          <div className="p-4 rounded-xl bg-background border border-panel-border flex items-start gap-4">
            <div className={cn("p-2 rounded-lg shrink-0", vaultConfigured ? "bg-success/10 text-success" : "bg-muted-foreground/10 text-muted-foreground")}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-medium mb-1">Vault Protection</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {vaultConfigured
                  ? "Your vault is configured. Notes moved to the vault are protected with your PIN."
                  : "Set up a PIN to protect sensitive notes in your vault."}
              </p>
            </div>
          </div>
          {vaultConfigured ? (
            <button
              onClick={() => { setSecurityMode("reset"); setSecurityStep("current"); setSecurityError(""); setSecurityFirstPin(""); setSecurityCurrentPin(""); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-warning/10 border border-warning/20 text-warning hover:bg-warning/20 text-sm font-medium transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              Reset Vault PIN
            </button>
          ) : (
            <button
              onClick={() => { setSecurityMode("setup"); setSecurityStep("new"); setSecurityError(""); setSecurityFirstPin(""); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-ai-accent/10 border border-ai-accent/20 text-ai-accent hover:bg-ai-accent/20 text-sm font-medium transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Set Vault PIN
            </button>
          )}
        </>
      ) : (
        <div className="py-2">
          <PinPad
            key={`${securityMode}-${securityStep}`}
            title={getSecurityStepInfo().title}
            subtitle={getSecurityStepInfo().subtitle}
            error={securityError}
            onSubmit={handleSecurityPinSubmit}
            onCancel={() => { setSecurityMode("idle"); setSecurityError(""); }}
            submitLabel={securityStep === "confirm" ? "Confirm" : "Next"}
          />
        </div>
      )}
    </section>
  );
}
