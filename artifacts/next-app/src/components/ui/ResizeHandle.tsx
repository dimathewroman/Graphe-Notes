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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // touch-action: none stops the browser from interpreting the drag as a
      // scroll/pan gesture on touch screens.
      style={{ touchAction: "none" }}
      className={cn(
        // w-1 visual + w-3 hit zone via padding on touch — gives finger room
        // to grab without growing layout width.
        "w-1 shrink-0 cursor-col-resize group relative z-10 select-none",
        className
      )}
    >
      {/* Visible 1px separator — centered inside the 4px hit zone.
          group-hover: fires whenever the 4px outer div is hovered (consistent),
          not just the 1px inner line (inconsistent). */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors duration-150",
          isDragging
            ? "bg-primary/50"
            : "bg-panel-border group-hover:bg-primary/40"
        )}
      />
    </div>
  );
}
