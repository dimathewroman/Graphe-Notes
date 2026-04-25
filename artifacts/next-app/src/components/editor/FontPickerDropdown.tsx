import type { useEditor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { FONTS } from "./ai-action-groups";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";

export function FontPickerDropdown({
  editor,
  onClose,
  triggerRef,
}: {
  editor: ReturnType<typeof useEditor>;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}) {
  if (!editor) return null;

  const activeFont = editor.getAttributes("textStyle").fontFamily as string | undefined;

  const applyFont = (value: string | null) => {
    if (value === null) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(value).run();
    }
    onClose();
  };

  return (
    <Popover open onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor virtualRef={triggerRef as React.RefObject<HTMLElement>} />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="w-48 p-0 py-1.5 bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top"
      >
        {FONTS.map((font) => {
          const isActive = font.value === null
            ? !activeFont
            : activeFont === font.value || activeFont === font.family;
          return (
            <button
              key={font.label}
              onClick={() => applyFont(font.value)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors hover:bg-panel-hover",
                isActive && "text-primary bg-panel"
              )}
              style={{ fontFamily: font.family }}
            >
              {font.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
