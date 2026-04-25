import { useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import { Link2, Unlink } from "lucide-react";
import { ToolbarButton } from "./ToolbarButton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function LinkPopover({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const openLinkPopover = () => {
    const existing = editor.getAttributes("link").href as string | undefined;
    setUrl(existing ?? "");
    setOpen(true);
    setTimeout(() => linkInputRef.current?.focus(), 30);
  };

  const applyLink = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setOpen(false);
    setUrl("");
  };

  const close = () => { setOpen(false); setUrl(""); };

  return (
    <Popover open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <PopoverTrigger asChild>
        <div className="shrink-0">
          <ToolbarButton
            command={openLinkPopover}
            active={editor.isActive("link")}
            icon={<Link2 className="w-4 h-4" />}
            title="Insert / edit link (Ctrl+K)"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="flex items-center gap-1.5 bg-popover border-panel-border rounded-xl shadow-xl px-3 py-2 min-w-[280px] w-auto luminance-border-top"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={linkInputRef}
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); applyLink(); }
            e.stopPropagation();
          }}
          className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/60 min-w-0"
        />
        {editor.isActive("link") && (
          <button
            onClick={() => { editor.chain().focus().unsetLink().run(); close(); }}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove link"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={applyLink}
          className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors"
        >
          Apply
        </button>
      </PopoverContent>
    </Popover>
  );
}
