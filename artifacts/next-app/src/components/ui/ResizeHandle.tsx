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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    lastX.current = e.clientX;
    setIsDragging(true);
    onResizeStart?.();
  }, [onResizeStart]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onResizeEnd?.();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, onResize, onResizeEnd]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        // w-1 = 4px wide — gives a reliable hover target without eating layout space
        "w-1 shrink-0 cursor-col-resize group relative z-10",
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
