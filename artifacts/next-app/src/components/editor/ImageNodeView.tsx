// Custom TipTap image node view — selection ring, floating edit toolbar, source badge, resize handles.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, Trash2, Link2, Upload, Check, X, Download } from "lucide-react";
import NextImage from "next/image";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useDemoMode } from "@/lib/demo-context";
import * as Sentry from "@sentry/nextjs";

function isSupabaseSrc(src: string): boolean {
  return src.includes("supabase.co") || src.includes("supabase.in");
}

function isUploadedSrc(src: string): boolean {
  return src.startsWith("blob:") || isSupabaseSrc(src);
}

function ImageToolbar({
  src,
  alt,
  attachmentId,
  downloadUrl,
  onAltChange,
  onDelete,
  onClose,
  triggerRect,
}: {
  src: string;
  alt: string;
  attachmentId: string | null;
  downloadUrl: string | null;
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
  const isSupabase = isSupabaseSrc(src);

  const handleDownload = () => {
    // Demo mode: downloadUrl holds the original file (e.g. HEIC); use it if present.
    // Also covers blob src (plain JPEG/PNG demo uploads) and SVG placeholder fallback.
    if (downloadUrl || src.startsWith("blob:") || src.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = downloadUrl ?? src;
      a.download = alt || "image";
      a.click();
      return;
    }
    // v2: use attachment ID for DB-backed download with original filename
    if (attachmentId) {
      window.open(`/api/attachments/download?id=${encodeURIComponent(attachmentId)}`, "_blank", "noopener,noreferrer");
      return;
    }
    // v1 legacy: extract storagePath from signed URL, serve file directly
    if (isSupabase) {
      const match = src.match(/\/object\/(?:sign|public)\/([^?]+)/);
      if (match) {
        window.open(`/api/attachments/download?path=${encodeURIComponent(match[1])}`, "_blank", "noopener,noreferrer");
        return;
      }
    }
    window.open(src, "_blank", "noopener,noreferrer");
  };

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
        {isUploaded && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
        )}
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
  const isDemo = useDemoMode();
  const imgRef = useRef<HTMLImageElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const src = node.attrs.src as string ?? "";
  const alt = node.attrs.alt as string ?? "";
  const attachmentId = node.attrs.attachmentId as string | null ?? null;
  const downloadUrl = node.attrs.downloadUrl as string | null ?? null;
  const isAnimated = node.attrs.isAnimated as boolean ?? false;
  const widthAttr = node.attrs.width as number | null ?? null;

  // X-A1: the signed URL baked into notes.content was minted for only 7 days, so
  // inline images 400 after it expires. Re-resolve a fresh signed URL at render
  // time via the attachmentId (only for Supabase-hosted images that carry one;
  // external images and demo mode use their src as-is). This fixes both new and
  // existing (baked-URL) notes without persisting a long-lived URL forever.
  const [resolvedSrc, setResolvedSrc] = useState(src);
  useEffect(() => {
    setResolvedSrc(src);
    if (isDemo || !attachmentId || !isSupabaseSrc(src)) return;
    let cancelled = false;
    authenticatedFetch(`/api/attachments/sign?id=${encodeURIComponent(attachmentId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { url?: string } | null) => {
        if (!cancelled && data?.url) setResolvedSrc(data.url);
      })
      .catch((err) => Sentry.captureException(err));
    return () => {
      cancelled = true;
    };
  }, [src, attachmentId, isDemo]);

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

  const handleClick = () => {
    const rect = imgRef.current?.getBoundingClientRect() ?? null;
    setImgRect(rect);
    setShowToolbar(v => !v);
  };

  const handleResizeStart = (e: React.PointerEvent, side: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startWidth = widthAttr ?? (imgRef.current?.offsetWidth ?? 200);
    const maxWidth = (imgRef.current?.closest(".ProseMirror") as HTMLElement | null)?.clientWidth ?? 800;
    const MIN_WIDTH = 100;
    let currentWidth = startWidth;
    let rafId = 0;

    setIsResizing(true);

    const onPointerMove = (moveEvt: PointerEvent) => {
      const delta = side === "right"
        ? moveEvt.clientX - startX
        : startX - moveEvt.clientX;
      const clamped = Math.round(Math.min(maxWidth - 32, Math.max(MIN_WIDTH, startWidth + delta)));
      currentWidth = clamped;
      // Direct DOM mutation throttled to rAF — bypasses React/TipTap for 60fps drag
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (imgRef.current) {
          imgRef.current.style.width = `${clamped}px`;
          imgRef.current.style.height = "auto";
        }
      });
    };

    const onPointerUp = () => {
      cancelAnimationFrame(rafId);
      target.releasePointerCapture(e.pointerId);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      setIsResizing(false);
      // Single transaction on release — commits the final width to the document
      updateAttributes({ width: currentWidth });
    };

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  };

  const showHandles = selected || isResizing;

  // NextImage (Supabase): needs explicit style to fill container or respect fixed width.
  // Plain <img> (external/blob): when no widthAttr, let max-w-full handle natural sizing;
  // setting width:100% on inline-block parent causes a circular 2×2px collapse.
  const nextImageStyle: React.CSSProperties = widthAttr
    ? { width: `${widthAttr}px`, height: "auto" }
    : { width: "100%", height: "auto" };

  const plainImageStyle: React.CSSProperties | undefined = widthAttr
    ? { width: `${widthAttr}px`, height: "auto" }
    : undefined;

  const imageClass = [
    "max-w-full rounded transition-all duration-150 cursor-pointer",
    selected || showToolbar
      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
      : "hover:ring-1 hover:ring-primary/40 hover:ring-offset-1 hover:ring-offset-background",
  ].join(" ");

  const handleClass = (side: "left" | "right") => [
    // touch-none: touch-drag resizes instead of scrolling. coarse:w-4 widens the
    // grab target on touch devices (the drag itself already uses Pointer Events).
    `absolute top-1/2 -translate-y-1/2 w-2 coarse:w-4 h-12 bg-primary/80 rounded cursor-ew-resize touch-none`,
    `transition-opacity duration-150`,
    side === "right" ? "right-0 rounded-l rounded-r-none" : "left-0 rounded-r rounded-l-none",
    showHandles ? "opacity-100" : "opacity-0 group-hover:opacity-100",
  ].join(" ");

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block relative group"
      style={{ verticalAlign: "bottom" }}
    >
      {isSupabaseSrc(src) ? (
        // next/image for Supabase-hosted images: format negotiation, lazy loading, CDN caching.
        // Animated images (GIF proxy / animated AVIF) must use unoptimized={true} so the
        // Next.js image optimizer doesn't strip animation frames from the output.
        // widthAttr guard: when null, pass width={0} + style width:100% (existing behaviour).
        // When set, pass actual pixel width so the optimizer requests the right size.
        <NextImage
          ref={imgRef as React.Ref<HTMLImageElement>}
          src={resolvedSrc}
          alt={alt}
          width={widthAttr ?? 0}
          height={0}
          sizes="(max-width: 768px) 100vw, 80vw"
          draggable={false}
          onClick={handleClick}
          className={imageClass}
          style={nextImageStyle}
          unoptimized={isAnimated}
        />
      ) : (
        // blob: URLs during upload-in-progress, or external linked images
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={resolvedSrc}
          alt={alt}
          draggable={false}
          onClick={handleClick}
          className={imageClass}
          style={plainImageStyle}
        />
      )}

      {/* Resize handle — left */}
      <div
        className={handleClass("left")}
        data-testid="resize-handle-left"
        onPointerDown={(e) => handleResizeStart(e, "left")}
      />
      {/* Resize handle — right */}
      <div
        className={handleClass("right")}
        data-testid="resize-handle-right"
        onPointerDown={(e) => handleResizeStart(e, "right")}
      />

      {showToolbar && imgRect && (
        <ImageToolbar
          src={src}
          alt={alt}
          attachmentId={attachmentId}
          downloadUrl={downloadUrl}
          onAltChange={(newAlt) => updateAttributes({ alt: newAlt })}
          onDelete={() => {
            setShowToolbar(false);
            // X-A2: releasing the file on an EXPLICIT remove (this toolbar Trash
            // action) — not on undo/cut — so the attachment is soft-deleted and
            // no longer orphaned + quota-counted. Best-effort; the node is removed
            // regardless. The DELETE route also strips the inline <img> server-side.
            if (attachmentId && !isDemo) {
              void authenticatedFetch(`/api/attachments/${attachmentId}`, {
                method: "DELETE",
              }).catch((err) => Sentry.captureException(err));
            }
            deleteNode();
          }}
          onClose={() => setShowToolbar(false)}
          triggerRect={imgRect}
        />
      )}
    </NodeViewWrapper>
  );
}
