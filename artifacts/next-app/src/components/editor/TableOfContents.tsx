import { useEffect, useState } from "react";
import { useEditor } from "@tiptap/react";
import { X, BookOpen } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/utils";

interface HeadingItem {
  level: 1 | 2 | 3;
  text: string;
  pos: number;
}

interface Props {
  editor: ReturnType<typeof useEditor> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TableOfContents({ editor, isOpen, onClose }: Props) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);

  useEffect(() => {
    if (!editor) return;

    const extractHeadings = () => {
      const items: HeadingItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          items.push({
            level: node.attrs.level as 1 | 2 | 3,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };

    // Extract immediately (catches initial content)
    extractHeadings();

    const onUpdate = () => extractHeadings();
    const onTransaction = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      if (transaction.docChanged) extractHeadings();
    };

    editor.on("update", onUpdate);
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("update", onUpdate);
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  const scrollToHeading = (pos: number) => {
    if (!editor) return;
    const domNode = editor.view.nodeDOM(pos) as Element | null;
    if (domNode) {
      domNode.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    editor.chain().focus().setTextSelection(pos + 1).run();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 left-0 w-full md:w-72 bg-panel border-r border-panel-border flex flex-col z-20 shadow-2xl">
      {/* Header */}
      <div className="h-14 border-b border-panel-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="w-4 h-4 text-primary" />
          Table of Contents
        </div>
        <IconButton onClick={onClose} title="Close">
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      {/* TOC list */}
      <div className="flex-1 overflow-y-auto py-2 px-2">
        {headings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-8 gap-3 text-center px-4">
            <BookOpen className="w-8 h-8 text-muted-foreground opacity-30" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add headings to generate a table of contents
            </p>
          </div>
        ) : (
          <ul>
            {headings.map((h, i) => (
              <li key={i}>
                <button
                  onClick={() => scrollToHeading(h.pos)}
                  title={h.text}
                  className={cn(
                    "w-full text-left text-sm text-foreground/70 hover:text-foreground hover:bg-white/5 cursor-pointer py-1.5 pr-3 rounded-md transition-colors truncate block",
                    h.level === 1 && "pl-3 font-medium",
                    h.level === 2 && "pl-6",
                    h.level === 3 && "pl-9 text-xs"
                  )}
                >
                  {h.text || <span className="text-muted-foreground italic">Untitled heading</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
