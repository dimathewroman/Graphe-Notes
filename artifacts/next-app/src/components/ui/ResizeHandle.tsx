import { useCallback, useEffect, useRef, useState } from "react";

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
      className={`w-px shrink-0 cursor-col-resize group relative z-10 bg-panel-border ${className ?? ""}`}
    >
      <div
        className={`absolute inset-y-0 -left-1 -right-1 transition-colors ${
          isDragging ? "bg-primary/30" : "hover:bg-primary/15"
        }`}
      />
    </div>
  );
}
