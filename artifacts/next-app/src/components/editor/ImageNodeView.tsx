// Custom TipTap image node view — selection ring, floating edit toolbar, source badge.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, Trash2, Link2, Upload, Check, X } from "lucide-react";

function isUploadedSrc(src: string): boolean {
  return src.startsWith("blob:") || src.includes("supabase.co") || src.includes("supabase.in");
}

function ImageToolbar({
  src,
  alt,
  onAltChange,
  onDelete,
  onClose,
  triggerRect,
}: {
  src: string;
  alt: string;
  onAltChange: (alt: string) => void;
  onDelete: () => void;
  onClose: () => void;
  triggerRect: DOMRect;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [editingAlt, setEditingAlt] = useState(false);
  const [draft, setDraft] = useState(alt);

  // Position below the image, clamped to viewport
  const [style, setStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    const pad = 8;
    const vw = window.innerWidth;
    const estimate = 280;
    let left = triggerRect.left + triggerRect.width / 2 - estimate / 2;
    left = Math.max(pad, Math.min(vw - estimate - pad, left));
    const top = triggerRect.bottom + 8;
    setStyle({ position: "fixed", top, left, zIndex: 50, minWidth: estimate });
  }, [triggerRect]);

  // Close on outside click
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  const commitAlt = () => {
    onAltChange(draft);
    setEditingAlt(false);
  };

  const isUploaded = isUploadedSrc(src);

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1.5 flex flex-col gap-1 luminance-border-top"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Source badge row */}
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
        {isUploaded
          ? <><Upload className="w-3 h-3 text-primary/70" /> <span className="text-primary/70 font-medium">Uploaded</span></>
          : <><Link2 className="w-3 h-3" /> <span>Linked via URL</span></>
        }
      </div>

      <div className="h-px bg-panel-border" />

      {/* Alt text */}
      {editingAlt ? (
        <div className="flex items-center gap-1 px-1">
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commitAlt();
              if (e.key === "Escape") { setDraft(alt); setEditingAlt(false); }
            }}
            placeholder="Alt text…"
            className="flex-1 bg-transparent border border-panel-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary min-w-0"
          />
          <button onClick={commitAlt} className="p-1 rounded hover:bg-primary/10 text-primary">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setDraft(alt); setEditingAlt(false); }} className="p-1 rounded hover:bg-panel text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditingAlt(true)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-panel hover:text-foreground transition-colors text-left w-full"
        >
          <span className="truncate">{alt ? `Alt: "${alt}"` : "Add alt text…"}</span>
        </button>
      )}

      <div className="h-px bg-panel-border" />

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => window.open(src, "_blank", "noopener,noreferrer")}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open
        </button>
        <button
          onClick={async () => {
            try { await navigator.clipboard.writeText(src); } catch {}
          }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
        >
          <Link2 className="w-3.5 h-3.5" />
          Copy URL
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove
        </button>
      </div>
    </div>,
    document.body
  );
}

export function ImageNodeView({ node, selected, deleteNode, updateAttributes }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);

  const src = node.attrs.src as string ?? "";
  const alt = node.attrs.alt as string ?? "";

  // Show toolbar when selected (keyboard or click)
  useEffect(() => {
    if (selected) {
      const rect = imgRef.current?.getBoundingClientRect() ?? null;
      setImgRect(rect);
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  }, [selected]);

  // Recompute rect on scroll / resize while open
  useEffect(() => {
    if (!showToolbar) return;
    const update = () => setImgRect(imgRef.current?.getBoundingClientRect() ?? null);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showToolbar]);

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block relative"
      style={{ verticalAlign: "bottom" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onClick={() => {
          const rect = imgRef.current?.getBoundingClientRect() ?? null;
          setImgRect(rect);
          setShowToolbar(v => !v);
        }}
        className={[
          "max-w-full rounded transition-all duration-150 cursor-pointer",
          selected || showToolbar
            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
            : "hover:ring-1 hover:ring-primary/40 hover:ring-offset-1 hover:ring-offset-background",
        ].join(" ")}
      />

      {showToolbar && imgRect && (
        <ImageToolbar
          src={src}
          alt={alt}
          onAltChange={(newAlt) => updateAttributes({ alt: newAlt })}
          onDelete={() => { setShowToolbar(false); deleteNode(); }}
          onClose={() => setShowToolbar(false)}
          triggerRect={imgRect}
        />
      )}
    </NodeViewWrapper>
  );
}
