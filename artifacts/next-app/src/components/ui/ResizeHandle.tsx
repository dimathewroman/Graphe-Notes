import { useCallback, useRef, useState } from "react";
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
  // Ref mirror of the dragging flag so the pointer handlers never read a stale
  // closure and act between capture-release and the state flush.
  const draggingRef = useRef(false);

  // Pointer Events (not Mouse Events) so the divider drags by touch and stylus,
  // not just mouse. setPointerCapture keeps every move/up routed to this element
  // even if the pointer strays off it mid-drag, so no document-level listeners.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    lastX.current = e.clientX;
    draggingRef.current = true;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    onResizeStart?.();
  }, [onResizeStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const delta = e.clientX - lastX.current;
    lastX.current = e.clientX;
    onResize(delta);
  }, [onResize]);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    // releasePointerCapture throws if the pointer is already gone — ignore.
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    document.body.style.userSelect = "";
    onResizeEnd?.();
  }, [onResizeEnd]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        // w-1 = 4px wide — reliable pointer target without eating layout space.
        // touch-none: touch-action none so a touch-drag resizes instead of scrolling.
        "w-1 shrink-0 cursor-col-resize group relative z-10 bg-editor touch-none",
        className
      )}
    >
      {/* Coarse-pointer hit expander — invisible, widens the touch target ~24px
          horizontally without changing the visible 4px divider. Pointer events on
          it bubble to the parent's handlers (currentTarget stays the divider). */}
      <span
        aria-hidden
        className="absolute inset-y-0 -left-2.5 -right-2.5 hidden coarse:block touch-none"
      />
      {/* Visible 1px separator — centered inside the hit zone. group-hover fires
          whenever the 4px outer div (not just the 1px line) is hovered. */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-px transition-colors duration-150",
          isDragging
            ? "bg-primary/50"
            : "bg-panel-border group-hover:bg-primary/40"
        )}
      />
    </div>
  );
}
