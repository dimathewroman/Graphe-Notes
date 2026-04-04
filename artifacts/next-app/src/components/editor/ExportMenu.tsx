// Desktop export dropdown (PDF / Markdown).

import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

export function ExportMenu({ onExportPdf, onExportMarkdown }: {
  onExportPdf: () => void;
  onExportMarkdown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <IconButton onClick={() => setOpen(!open)} active={open} title="Export note">
        <Download className="w-4 h-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] bg-popover border border-panel-border rounded-xl shadow-2xl py-1">
          <button
            onClick={() => { onExportPdf(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
          <button
            onClick={() => { onExportMarkdown(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export as Markdown
          </button>
        </div>
      )}
    </div>
  );
}
