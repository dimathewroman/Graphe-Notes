import {
  Sun, Moon, Monitor,
  Zap, Wind, Minus, CircleDot, Contrast, Accessibility,
} from "lucide-react";
import { useAppStore } from "@/store";
import type { MotionLevel, DarkModeLevel, ColorblindMode } from "@/store";
import { applyDarkModeLevel, applyColorblindMode } from "@/hooks/use-atmosphere";
import { useSetMotionLevel } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";

export const ACCENT_PRESETS = [
  { name: "Periwinkle", value: "216 78% 63%",  hex: "#5B93E8" },
  { name: "Indigo",  value: "239 84% 67%",  hex: "#6366f1" },
  { name: "Purple",  value: "270 76% 65%",  hex: "#a855f7" },
  { name: "Rose",    value: "350 89% 62%",  hex: "#f43f5e" },
  { name: "Amber",   value: "38 92% 50%",   hex: "#f59e0b" },
  { name: "Emerald", value: "160 84% 39%",  hex: "#10b981" },
  { name: "Cyan",    value: "189 94% 43%",  hex: "#06b6d4" },
  { name: "Slate",   value: "215 25% 57%",  hex: "#64748b" },
];

export type ThemeMode = "dark" | "light";

export function applyTheme(mode: ThemeMode, accent: string) {
  if (mode === "light") {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
  if (accent) {
    document.documentElement.style.setProperty("--primary", accent);
    document.documentElement.style.setProperty("--ring", accent);
  } else {
    document.documentElement.style.removeProperty("--primary");
    document.documentElement.style.removeProperty("--ring");
  }
}

// Theme mode + accent color are provisional (live preview via applyTheme, but
// persisted only on the footer's Save) — so they're owned by the SettingsModal
// shell and passed in, exactly like the Quick Bits tab. Discard therefore reverts
// them on reload. Motion / dark-level / colorblind persist immediately (below),
// which was their original behavior too.
interface AppearanceSettingsTabProps {
  themeMode: ThemeMode;
  accentColor: string;
  onModeChange: (mode: ThemeMode) => void;
  onAccentChange: (value: string) => void;
}

export function AppearanceSettingsTab({ themeMode, accentColor, onModeChange, onAccentChange }: AppearanceSettingsTabProps) {
  const motionLevel = useAppStore(s => s.motionLevel);
  const darkModeLevel = useAppStore(s => s.darkModeLevel);
  const setDarkModeLevel = useAppStore(s => s.setDarkModeLevel);
  const colorblindMode = useAppStore(s => s.colorblindMode);
  const setColorblindMode = useAppStore(s => s.setColorblindMode);
  const setMotionLevelWithTracking = useSetMotionLevel();

  const handleMotionChange = (level: MotionLevel) => {
    setMotionLevelWithTracking(level);
    localStorage.setItem("motion_level", level);
  };

  const handleDarkLevelChange = (level: DarkModeLevel) => {
    setDarkModeLevel(level);
    applyDarkModeLevel(level);
  };

  const handleColorblindChange = (mode: ColorblindMode) => {
    setColorblindMode(mode);
    applyColorblindMode(mode);
  };

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Color Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "dark" as ThemeMode, label: "Dark", icon: Moon },
            { id: "light" as ThemeMode, label: "Light", icon: Sun },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onModeChange(opt.id)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium",
                themeMode === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <opt.icon className="w-5 h-5" />
              {opt.label}
            </button>
          ))}
          <button
            disabled
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-panel-border bg-background text-muted-foreground opacity-40 cursor-not-allowed text-sm"
          >
            <Monitor className="w-5 h-5" />
            System
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accent Color</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACCENT_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => onAccentChange(preset.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium",
                accentColor === preset.value
                  ? "border-2 bg-background text-foreground"
                  : "border-panel-border bg-background text-muted-foreground hover:text-foreground hover:border-panel-hover"
              )}
              style={accentColor === preset.value ? { borderColor: preset.hex } : {}}
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: preset.hex }} />
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Motion</h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "full" as MotionLevel, label: "Full", icon: Zap, desc: "Spring physics" },
            { id: "reduced" as MotionLevel, label: "Reduced", icon: Wind, desc: "No springs" },
            { id: "minimal" as MotionLevel, label: "Minimal", icon: Minus, desc: "Opacity only" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleMotionChange(opt.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium",
                motionLevel === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <opt.icon className="w-4 h-4" />
              <span>{opt.label}</span>
              <span className="text-2xs font-normal opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</h3>
        <div className="p-4 rounded-xl bg-background border border-panel-border space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm font-medium text-foreground">Sample Note</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">This is how your notes will look with the selected theme.</p>
          <div className="flex gap-2">
            <span className="px-2 py-0.5 rounded-full text-2xs bg-primary/10 text-primary border border-primary/20">#tag</span>
            <button className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Button</button>
          </div>
        </div>
      </section>

      {/* Dark mode level — only shown in dark mode */}
      {themeMode === "dark" && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dark Intensity</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: "soft" as DarkModeLevel, label: "Soft", icon: Moon, desc: "Warm & gentle", swatch: "#1C1F28" },
              { id: "default" as DarkModeLevel, label: "Dark", icon: CircleDot, desc: "Balanced depth", swatch: "#151720" },
              { id: "oled" as DarkModeLevel, label: "OLED", icon: Contrast, desc: "True black", swatch: "#000000" },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleDarkLevelChange(opt.id)}
                data-testid={`dark-level-${opt.id}`}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium",
                  darkModeLevel === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="w-5 h-5 rounded-full border border-panel-border shrink-0" style={{ backgroundColor: opt.swatch }} />
                <span>{opt.label}</span>
                <span className="text-2xs font-normal opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Accessibility — colorblind modes */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Accessibility</h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "none" as ColorblindMode, label: "Default", desc: "Standard colors" },
            { id: "protanopia" as ColorblindMode, label: "P/D", desc: "Red-green safe" },
            { id: "tritanopia" as ColorblindMode, label: "Trit.", desc: "Blue-yellow safe" },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleColorblindChange(opt.id)}
              data-testid={`colorblind-${opt.id}`}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-sm font-medium",
                colorblindMode === opt.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <Accessibility className="w-4 h-4" />
              <span>{opt.label}</span>
              <span className="text-2xs font-normal opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
        <p className="text-2xs text-muted-foreground leading-relaxed">
          Remaps semantic colors (errors, success, warnings) for colorblind users. P/D = Protanopia &amp; Deuteranopia.
        </p>
      </section>
    </>
  );
}
