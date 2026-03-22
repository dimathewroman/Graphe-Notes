import { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Plus, X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationCadenceEditorProps {
  value: number[];
  onChange: (hours: number[]) => void;
  disabled?: boolean;
}

const PRESETS = [
  { label: "12 hours before", hours: 12 },
  { label: "24 hours before", hours: 24 },
  { label: "2 days before", hours: 48 },
  { label: "3 days before", hours: 72 },
  { label: "5 days before", hours: 120 },
];

function labelHours(h: number): string {
  if (h % 24 === 0) {
    const d = h / 24;
    return `${d} day${d !== 1 ? "s" : ""} before`;
  }
  return `${h} hour${h !== 1 ? "s" : ""} before`;
}

export function NotificationCadenceEditor({ value, onChange, disabled }: NotificationCadenceEditorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [customUnit, setCustomUnit] = useState<"hours" | "days">("hours");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sorted = [...value].sort((a, b) => b - a);
  const availablePresets = PRESETS.filter((p) => !value.includes(p.hours));

  const openMenu = useCallback(() => {
    if (!addBtnRef.current) return;
    const rect = addBtnRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 220;
    const padding = 8;

    let left = rect.left;
    let top = rect.bottom + 4;

    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }
    if (left < padding) left = padding;
    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - 4;
    }

    setMenuPos({ top, left });
    setMenuOpen(true);
    setShowCustom(false);
    setCustomAmount("");
    setCustomUnit("hours");
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setShowCustom(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        addBtnRef.current && !addBtnRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, closeMenu]);

  const addHours = (hours: number) => {
    if (!value.includes(hours)) {
      onChange([...value, hours]);
    }
    closeMenu();
  };

  const removeHours = (hours: number) => {
    onChange(value.filter((h) => h !== hours));
  };

  const handleCustomSave = () => {
    const amount = parseInt(customAmount, 10);
    if (!amount || amount <= 0) return;
    const hours = customUnit === "days" ? amount * 24 : amount;
    if (!value.includes(hours)) {
      onChange([...value, hours]);
    }
    closeMenu();
  };

  const menu = menuOpen
    ? ReactDOM.createPortal(
        <div
          ref={menuRef}
          style={{ top: menuPos.top, left: menuPos.left, width: 220 }}
          className="fixed z-50 bg-panel border border-panel-border rounded-xl shadow-xl overflow-hidden"
        >
          {!showCustom ? (
            <div className="py-1">
              {availablePresets.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">All presets added</div>
              )}
              {availablePresets.map((p) => (
                <button
                  key={p.hours}
                  onClick={() => addHours(p.hours)}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-panel-hover transition-colors"
                >
                  {p.label}
                </button>
              ))}
              <div className="mx-2 my-1 border-t border-panel-border" />
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-panel-hover hover:text-foreground transition-colors"
              >
                Custom…
              </button>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Custom reminder</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="number"
                  min={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCustomSave(); }}
                  placeholder="e.g. 6"
                  className="w-20 px-2 py-1.5 text-sm bg-background border border-panel-border rounded-lg outline-none focus:border-primary text-foreground"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as "hours" | "days")}
                  className="flex-1 px-2 py-1.5 text-sm bg-background border border-panel-border rounded-lg outline-none focus:border-primary text-foreground"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCustomSave}
                  disabled={!customAmount || parseInt(customAmount) <= 0}
                  className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowCustom(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="space-y-2">
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No reminders set</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((h) => (
            <div
              key={h}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border border-panel-border"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-foreground">{labelHours(h)}</span>
              </div>
              <button
                onClick={() => removeHours(h)}
                disabled={disabled}
                className={cn(
                  "p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors",
                  disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        ref={addBtnRef}
        onClick={openMenu}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-panel-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Notification
      </button>

      {menu}
    </div>
  );
}
