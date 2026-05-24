// Turn-into block type selector for the editor toolbar.
// Verified: editor.chain().focus().clearNodes().setDetails().run() works as a single chain
// because TipTap's createChainableState passes the accumulated transaction doc/selection to
// each subsequent command, so setDetails() sees the post-clearNodes paragraph.

import type { useEditor } from "@tiptap/react";
import { ChevronDown, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Code2, ChevronRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BlockType = {
  label: string;
  icon: React.ReactNode;
  isActive: (editor: NonNullable<ReturnType<typeof useEditor>>) => boolean;
  apply: (editor: NonNullable<ReturnType<typeof useEditor>>) => void;
};

const BLOCK_TYPES: BlockType[] = [
  {
    label: "Normal text",
    icon: <span className="text-xs font-medium leading-none">T</span>,
    isActive: (e) =>
      !e.isActive("heading") &&
      !e.isActive("bulletList") &&
      !e.isActive("orderedList") &&
      !e.isActive("taskList") &&
      !e.isActive("blockquote") &&
      !e.isActive("codeBlock") &&
      !e.isActive("details"),
    apply: (e) => e.chain().focus().clearNodes().setParagraph().unsetFontSize().run(),
  },
  {
    label: "Heading 1",
    icon: <Heading1 className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("heading", { level: 1 }),
    apply: (e) => e.chain().focus().clearNodes().setHeading({ level: 1 }).unsetFontSize().run(),
  },
  {
    label: "Heading 2",
    icon: <Heading2 className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("heading", { level: 2 }),
    apply: (e) => e.chain().focus().clearNodes().setHeading({ level: 2 }).unsetFontSize().run(),
  },
  {
    label: "Heading 3",
    icon: <Heading3 className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("heading", { level: 3 }),
    apply: (e) => e.chain().focus().clearNodes().setHeading({ level: 3 }).unsetFontSize().run(),
  },
  {
    label: "Bullet list",
    icon: <List className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("bulletList"),
    apply: (e) => e.chain().focus().clearNodes().toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    icon: <ListOrdered className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("orderedList"),
    apply: (e) => e.chain().focus().clearNodes().toggleOrderedList().run(),
  },
  {
    label: "Task list",
    icon: <ListTodo className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("taskList"),
    apply: (e) => e.chain().focus().clearNodes().toggleTaskList().run(),
  },
  {
    label: "Blockquote",
    icon: <Quote className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("blockquote"),
    apply: (e) => e.chain().focus().clearNodes().toggleBlockquote().run(),
  },
  {
    label: "Code block",
    icon: <Code2 className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("codeBlock"),
    apply: (e) => e.chain().focus().clearNodes().toggleCodeBlock().run(),
  },
  {
    label: "Toggle",
    icon: <ChevronRight className="w-3.5 h-3.5" />,
    isActive: (e) => e.isActive("details"),
    apply: (e) => e.chain().focus().clearNodes().setDetails().run(),
  },
];

export function NodeSelector({
  editor,
  open,
  onOpenChange,
}: {
  editor: ReturnType<typeof useEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!editor) return null;

  const activeType = BLOCK_TYPES.find((t) => t.isActive(editor)) ?? BLOCK_TYPES[0];

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="toolbar-node-selector-btn"
          title="Turn into…"
          className={`min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-1.5 md:px-1 py-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground transition-all duration-[var(--duration-micro)] hover:scale-[1.08] active:scale-[0.95] shrink-0 flex items-center gap-0.5${open ? " bg-primary/10 text-primary" : ""}`}
        >
          <span className="flex items-center justify-center w-4 h-4">
            {activeType.icon}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-44 p-1 bg-popover border-panel-border rounded-xl shadow-2xl luminance-border-top"
      >
        {BLOCK_TYPES.map((blockType) => {
          const isActive = blockType.isActive(editor);
          return (
            <DropdownMenuItem
              key={blockType.label}
              onSelect={() => {
                blockType.apply(editor);
                onOpenChange(false);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer${isActive ? " text-primary bg-primary/10" : ""}`}
            >
              <span className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0">
                {blockType.icon}
              </span>
              {blockType.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
