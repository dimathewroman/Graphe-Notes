import { useState, useCallback, useEffect, useRef } from "react";
import { Delete } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAnimationConfig } from "@/hooks/use-motion";

const MAX_PIN_LENGTH = 6;

interface PinPadProps {
  title: string;
  subtitle?: string;
  error?: string;
  /** Increment to trigger shake + sequential clear without remounting */
  shakeKey?: number;
  /** Tailwind bg class for filled dots — defaults to bg-primary */
  filledDotClass?: string;
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function PinPad({ title, subtitle, error, shakeKey = 0, filledDotClass = "bg-primary border-primary", onSubmit, onCancel, submitLabel = "Confirm" }: PinPadProps) {
  const [pin, setPin] = useState("");
  const [pressed, setPressed] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const shakeControls = useAnimation();
  const anim = useAnimationConfig();
  const prevShakeKey = useRef(shakeKey);

  const handleDigit = useCallback((digit: string) => {
    setPin(prev => prev.length < MAX_PIN_LENGTH ? prev + digit : prev);
    setPressed(digit);
    setTimeout(() => setPressed(null), 120);
  }, []);

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setPressed("back");
    setTimeout(() => setPressed(null), 120);
  }, []);

  const handleSubmit = useCallback(() => {
    if (pin.length >= 4) onSubmit(pin);
  }, [pin, onSubmit]);

  // Trigger shake + sequential dot clear when shakeKey increments
  useEffect(() => {
    if (shakeKey === prevShakeKey.current) return;
    prevShakeKey.current = shakeKey;

    setShaking(true);

    if (anim.level !== "minimal") {
      shakeControls.start({
        x: [0, 10, -10, 6, -6, 3, -3, 0],
        transition: { duration: 0.45, ease: "easeInOut" },
      });
    }

    // Sequential dot clear: right-to-left, 50ms stagger
    const currentLen = pin.length;
    for (let i = currentLen - 1; i >= 0; i--) {
      setTimeout(() => {
        setPin(prev => prev.slice(0, i));
        if (i === 0) setShaking(false);
      }, (currentLen - 1 - i) * 50 + 300);
    }
    if (currentLen === 0) setShaking(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeKey]);

  // Keyboard input: digits 0-9, Backspace, Enter
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDigit, handleBackspace, handleSubmit]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"];

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[280px] mx-auto">
      <div className="text-center mb-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      {/* Dots row — shakes on wrong PIN */}
      <motion.div animate={shakeControls} className="flex items-center gap-2.5 h-10">
        {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full border-2 transition-all duration-150",
              i < pin.length
                ? cn("scale-110", shaking ? "bg-destructive border-destructive" : filledDotClass)
                : "scale-100 border-muted-foreground/30"
            )}
          />
        ))}
      </motion.div>

      {error && <p className="text-xs text-destructive text-center">{error}</p>}

      <div className="grid grid-cols-3 gap-2 w-full">
        {digits.map((d, i) => {
          if (d === "") return <div key="spacer" />;
          if (d === "back") {
            return (
              <button
                key="back"
                type="button"
                onClick={handleBackspace}
                disabled={pin.length === 0}
                className={cn(
                  "h-14 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-panel hover:text-foreground transition-all active:scale-95",
                  pressed === "back" && "bg-panel scale-95",
                  pin.length === 0 && "opacity-30 pointer-events-none"
                )}
              >
                <Delete className="w-5 h-5" />
              </button>
            );
          }
          return (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className={cn(
                "h-14 rounded-xl text-lg font-medium text-foreground hover:bg-panel transition-all active:scale-95",
                pressed === d && "bg-panel scale-95"
              )}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 w-full mt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-panel-border text-sm text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pin.length < 4}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-40",
            "bg-primary hover:bg-primary-hover"
          )}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
