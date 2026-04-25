import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

// ─── Color palettes ──────────────────────────────────────────────────────────

const GRAYSCALE = [
  { hex: "#000000", label: "Black" },
  { hex: "#4B5563", label: "Dark Gray" },
  { hex: "#9CA3AF", label: "Gray" },
  { hex: "#E5E7EB", label: "Light Gray" },
  { hex: "#FFFFFF", label: "White" },
];

const RAINBOW_TEXT = [
  { hex: "#EF4444", label: "Red" },
  { hex: "#F97316", label: "Orange" },
  { hex: "#EAB308", label: "Yellow" },
  { hex: "#22C55E", label: "Green" },
  { hex: "#14B8A6", label: "Teal" },
  { hex: "#3B82F6", label: "Blue" },
  { hex: "#A855F7", label: "Purple" },
  { hex: "#EC4899", label: "Pink" },
];

const RAINBOW_HIGHLIGHT = [
  { hex: "#FCA5A5", label: "Red" },
  { hex: "#FED7AA", label: "Orange" },
  { hex: "#FEF08A", label: "Yellow" },
  { hex: "#BBF7D0", label: "Green" },
  { hex: "#99F6E4", label: "Teal" },
  { hex: "#BFDBFE", label: "Blue" },
  { hex: "#E9D5FF", label: "Purple" },
  { hex: "#FBCFE8", label: "Pink" },
];

// ─── HSV / hex helpers ────────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  const hi = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (hi) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [0, 1, 1];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, v];
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

// ─── Custom gradient color picker panel ──────────────────────────────────────

function CustomColorPanel({
  value,
  onApply,
  onCancel,
}: {
  value: string;
  onApply: (hex: string) => void;
  onCancel: () => void;
}) {
  const [hue, setHue] = useState<number>(0);
  const [sat, setSat] = useState<number>(1);
  const [val, setVal] = useState<number>(1);
  const [hexInput, setHexInput] = useState<string>(value);
  const gradientRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Sync from parent value on mount
  useEffect(() => {
    if (isValidHex(value)) {
      const [h, s, v] = hexToHsv(value);
      setHue(h);
      setSat(s);
      setVal(v);
      setHexInput(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitColor = useCallback((h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
  }, []);

  const currentHex = hsvToHex(hue, sat, val);

  const handleGradientPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = gradientRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setSat(s);
    setVal(v);
    emitColor(hue, s, v);
  }, [hue, emitColor]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    handleGradientPointer(e);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    handleGradientPointer(e);
  };
  const onPointerUp = () => { dragging.current = false; };

  const handleHueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value);
    setHue(h);
    emitColor(h, sat, val);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    if (isValidHex(hex)) {
      const [h, s, v] = hexToHsv(hex);
      setHue(h);
      setSat(s);
      setVal(v);
    }
  };

  const thumbX = `${sat * 100}%`;
  const thumbY = `${(1 - val) * 100}%`;
  const hueColor = hsvToHex(hue, 1, 1);

  return (
    <div className="mt-2 space-y-2">
      {/* 2D gradient picker */}
      <div
        ref={gradientRef}
        className="relative w-full h-32 rounded-lg cursor-crosshair select-none overflow-hidden"
        style={{
          background: `
            linear-gradient(to bottom, transparent, #000),
            linear-gradient(to right, #fff, ${hueColor})
          `,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Picker thumb */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{
            left: thumbX,
            top: thumbY,
            backgroundColor: hsvToHex(hue, sat, val),
          }}
        />
      </div>

      {/* Hue slider */}
      <div className="relative">
        <input
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={handleHueChange}
          className="w-full h-3 rounded-full cursor-pointer appearance-none"
          style={{
            background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          }}
        />
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded border border-panel-border shrink-0"
          style={{ backgroundColor: currentHex }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexInput}
          placeholder="#000000"
          maxLength={7}
          className="flex-1 bg-panel text-foreground text-xs font-mono px-2 py-1 rounded border border-panel-border outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Cancel / OK */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-8 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-panel-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onApply(currentHex)}
          className="flex-1 h-8 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ─── Color swatch button ──────────────────────────────────────────────────────

function Swatch({ hex, label, active, onClick }: { hex: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "w-6 h-6 rounded border transition-all hover:scale-110",
        hex === "#FFFFFF" ? "border-panel-border" : "border-transparent",
        active && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
      style={{ backgroundColor: hex }}
    />
  );
}

// ─── Main dropdown component ──────────────────────────────────────────────────

interface ColorPickerDropdownProps {
  type: "text" | "highlight";
  editor: Editor;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function ColorPickerDropdown({ type, editor, onClose, triggerRef }: ColorPickerDropdownProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customColor, setCustomColor] = useState("#3B82F6");

  const activeColor = type === "text"
    ? (editor.getAttributes("textStyle").color as string | undefined)
    : (editor.getAttributes("highlight").color as string | undefined);

  const applyColor = (hex: string) => {
    if (type === "text") {
      editor.chain().focus().setColor(hex).run();
    } else {
      editor.chain().focus().setHighlight({ color: hex }).run();
    }
  };

  const removeColor = () => {
    if (type === "text") {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
    onClose();
  };

  const rainbow = type === "text" ? RAINBOW_TEXT : RAINBOW_HIGHLIGHT;

  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor virtualRef={triggerRef as React.RefObject<HTMLElement>} />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-56 p-3 bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
      {/* None option — highlight only */}
      {type === "highlight" && (
        <>
          <button
            onClick={removeColor}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-panel-hover rounded-lg transition-colors mb-2"
          >
            <X className="w-3 h-3" />
            None
          </button>
          <div className="h-px bg-panel-border mb-2" />
        </>
      )}

      {/* Grayscale row */}
      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Grayscale</p>
      <div className="flex gap-1.5 mb-2">
        {GRAYSCALE.map((c) => (
          <Swatch
            key={c.hex}
            hex={c.hex}
            label={c.label}
            active={activeColor === c.hex}
            onClick={() => applyColor(c.hex)}
          />
        ))}
      </div>

      {/* Rainbow row */}
      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Colors</p>
      <div className="flex gap-1.5 mb-2">
        {rainbow.map((c) => (
          <Swatch
            key={c.hex}
            hex={c.hex}
            label={c.label}
            active={activeColor === c.hex}
            onClick={() => applyColor(c.hex)}
          />
        ))}
      </div>

      <div className="h-px bg-panel-border mb-2" />

      {/* Custom color toggle */}
      <button
        onClick={() => setShowCustom((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-panel-hover rounded-lg transition-colors"
      >
        <span>Custom color</span>
        <div className="w-4 h-4 rounded border border-panel-border" style={{ backgroundColor: customColor }} />
      </button>

      {showCustom && (
        <CustomColorPanel
          value={customColor}
          onApply={(hex) => {
            setCustomColor(hex);
            applyColor(hex);
            onClose();
          }}
          onCancel={() => setShowCustom(false)}
        />
      )}
      </PopoverContent>
    </Popover>
  );
}
