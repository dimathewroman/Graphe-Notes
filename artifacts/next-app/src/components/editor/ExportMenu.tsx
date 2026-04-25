import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function ExportMenu({ onExportPdf, onExportMarkdown }: {
  onExportPdf: () => void;
  onExportMarkdown: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <IconButton active={open} title="Export note">
          <Download className="w-4 h-4" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[190px] bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top">
        <DropdownMenuItem onClick={onExportPdf} className="gap-2.5 px-3 py-2.5">
          <Download className="w-4 h-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportMarkdown} className="gap-2.5 px-3 py-2.5">
          <FileText className="w-4 h-4" />
          Export as Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
