import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  onResizeStart?: () => void;
  className?: string;
}

export function ResizeHandle({ onResize, onResizeEnd, onResizeStart, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);
  const handleRef = useRef<HTMLDivElement>(null);

  // Pointer events unify mouse, touch, and stylus — fixes drag-to-resize on
  // iPad (touch and Magic Keyboard trackpad) and any other touch-screen device
  // that the previous mouse-only listeners ignored. setPointerCapture redirects
  // every subsequent move/up event to this element so the drag survives even
  // if the cursor leaves the handle, and stops the default text-selection /
  // panning behavior that was selecting text across the page on iPad.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lastX.current = e.clientX;
    setIsDragging(true);
    onResizeStart?.();
  }, [onResizeStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = e.clientX - lastX.current;
    lastX.current = e.clientX;
    onResize(delta);
  }, [isDragging, onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    setIsDragging(false);
    onResizeEnd?.();
  }, [isDragging, onResizeEnd]);

  // Suppress page-wide text selection only while dragging — the previous
  // implementation set this from a useEffect that fired after the drag
  // started, leaving a brief window where iPad selected text everywhere.
  useEffect(() => {
    if (!isDragging) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [isDragging]);

  return (
    <div
      ref={handleRef}
      className={cn(
        // The wrapper takes only 1px of layout width — the actual visible
        // separator. The pointer hit zone lives in the absolute child below,
        // which extends ±8px past the visible line so the user doesn't have
        // to land within a single pixel column.
        "w-px shrink-0 group relative z-10 select-none",
        className
      )}
    >
      {/* Visible 1px separator. */}
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-150 pointer-events-none",
          isDragging
            ? "bg-primary/50"
            : "bg-panel-border group-hover:bg-primary/40"
        )}
      />
      {/* Pointer hit zone — extends ±8px from the visible line so the handle
          is comfortable to grab on touch and easy to land on with a cursor.
          It sits in front of the separator (positive z-index relative to
          siblings) and captures the drag, but stays narrow in layout terms
          via -mx negative bleed and absolute positioning. */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        // touch-action: none stops the browser from interpreting the drag as
        // a scroll/pan gesture on touch screens.
        style={{ touchAction: "none" }}
        className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize"
      />
    </div>
  );
}
