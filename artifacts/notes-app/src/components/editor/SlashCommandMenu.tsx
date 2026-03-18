import { useEffect, useRef, useState, useCallback } from "react";
import { Extension } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  Heading1, Heading2, Heading3, Bold, Italic,
  List, ListOrdered, ListTodo, Minus, Table,
  Code, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Slash command definitions ────────────────────────────────────────────────

interface SlashCommand {
  label: string;
  description: string;
  icon: React.ReactNode;
  execute: (editor: Editor) => void;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    label: "Heading 1",
    description: "Large section heading",
    icon: <Heading1 className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: "Heading 2",
    description: "Medium section heading",
    icon: <Heading2 className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: "Heading 3",
    description: "Small section heading",
    icon: <Heading3 className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: "Bold",
    description: "Make text bold",
    icon: <Bold className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: "Italic",
    description: "Make text italic",
    icon: <Italic className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: "Bullet List",
    description: "Unordered list",
    icon: <List className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: "Numbered List",
    description: "Ordered list",
    icon: <ListOrdered className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    label: "Task List",
    description: "Checklist with checkboxes",
    icon: <ListTodo className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    label: "Horizontal Divider",
    description: "Full-width divider line",
    icon: <Minus className="w-4 h-4" />,
    execute: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    label: "Table",
    description: "Insert a 3×3 table",
    icon: <Table className="w-4 h-4" />,
    execute: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    label: "Code Block",
    description: "Monospace code block",
    icon: <Code className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    label: "Quote",
    description: "Blockquote",
    icon: <Quote className="w-4 h-4" />,
    execute: (e) => e.chain().focus().toggleBlockquote().run(),
  },
];

// ─── ProseMirror plugin state ─────────────────────────────────────────────────

interface SlashState {
  active: boolean;
  query: string;
  from: number;
}

const slashKey = new PluginKey<SlashState>("slashCommand");

// ─── TipTap Extension ─────────────────────────────────────────────────────────

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addStorage() {
    return { active: false, query: "", from: 0 } as SlashState;
  },

  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        key: slashKey,
        state: {
          init(): SlashState {
            return { active: false, query: "", from: 0 };
          },
          apply(tr, prev): SlashState {
            const meta = tr.getMeta(slashKey);
            if (meta !== undefined) return meta;
            // If doc changed while inactive, keep state
            if (!tr.docChanged && !tr.selectionSet) return prev;

            const { selection } = tr;
            const { $from } = selection;

            // Only in empty selections (cursor, no range)
            if (selection.from !== selection.to) {
              ext.storage.active = false;
              return { active: false, query: "", from: 0 };
            }

            // Look back from cursor to find a slash at start of word
            const textBefore = $from.nodeBefore?.textContent ?? "";
            const lineText = $from.parent.textContent.slice(0, $from.parentOffset);
            const slashMatch = lineText.match(/(^|[\s\n])\/(\S*)$/);

            if (slashMatch) {
              const query = slashMatch[2];
              const slashPos = $from.pos - query.length - 1;
              const newState: SlashState = { active: true, query, from: slashPos };
              ext.storage.active = newState.active;
              ext.storage.query = newState.query;
              ext.storage.from = newState.from;
              return newState;
            }

            // Deactivate if no slash pattern
            if (prev.active) {
              ext.storage.active = false;
              return { active: false, query: "", from: 0 };
            }
            // Suppress unused variable warning
            void textBefore;
            return prev;
          },
        },
        props: {
          handleKeyDown(view, event) {
            const state = slashKey.getState(view.state);
            if (!state?.active) return false;
            // Let the React component handle arrow/enter/escape via its own keydown listener
            // We only need to prevent default for keys the menu intercepts
            if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
              // Only intercept if the menu is actually rendered (React component gates this)
              return false;
            }
            if (event.key === "Escape") {
              view.dispatch(view.state.tr.setMeta(slashKey, { active: false, query: "", from: 0 }));
              ext.storage.active = false;
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

// ─── React menu component ─────────────────────────────────────────────────────

interface SlashCommandMenuProps {
  editor: Editor | null;
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [state, setState] = useState<SlashState>({ active: false, query: "", from: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(state.query.toLowerCase())
  );

  const dismiss = useCallback(() => {
    if (!editor) return;
    const pluginState = slashKey.getState(editor.state);
    if (pluginState?.active) {
      editor.view.dispatch(
        editor.state.tr.setMeta(slashKey, { active: false, query: "", from: 0 })
      );
    }
    // Also clear extension storage directly
    if (editor.storage.slashCommand) {
      editor.storage.slashCommand.active = false;
    }
    setState({ active: false, query: "", from: 0 });
  }, [editor]);

  const executeCommand = useCallback((cmd: SlashCommand) => {
    if (!editor) return;
    const { from } = state;
    const to = editor.state.selection.from;
    editor.chain()
      .focus()
      .deleteRange({ from, to })
      .run();
    // Small timeout so the deletion is committed before command runs
    setTimeout(() => {
      cmd.execute(editor);
    }, 0);
    dismiss();
  }, [editor, state, dismiss]);

  // Subscribe to editor updates to sync plugin state → React state
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const pluginState = slashKey.getState(editor.state);
      if (!pluginState) return;
      setState((prev) => {
        if (
          prev.active === pluginState.active &&
          prev.query === pluginState.query &&
          prev.from === pluginState.from
        ) return prev;
        return { ...pluginState };
      });
      // Reset selected index when query changes
      setSelectedIndex(0);
    };
    editor.on("update", sync);
    editor.on("transaction", sync);
    return () => {
      editor.off("update", sync);
      editor.off("transaction", sync);
    };
  }, [editor]);

  // Compute menu position from cursor coordinates
  useEffect(() => {
    if (!editor || !state.active) {
      setPosition(null);
      return;
    }
    try {
      const coords = editor.view.coordsAtPos(state.from);
      const editorRect = editor.view.dom.getBoundingClientRect();
      // Position below the slash character
      setPosition({
        top: coords.bottom + window.scrollY + 4,
        left: Math.max(editorRect.left, coords.left),
      });
    } catch {
      setPosition(null);
    }
  }, [editor, state.active, state.from]);

  // Scroll selected item into view
  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!state.active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + Math.max(1, filteredCommands.length)) % Math.max(1, filteredCommands.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [state.active, filteredCommands, selectedIndex, executeCommand, dismiss]);

  // Click outside to dismiss
  useEffect(() => {
    if (!state.active) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [state.active, dismiss]);

  if (!state.active || !position || filteredCommands.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 bg-popover border border-panel-border rounded-xl shadow-2xl py-1.5 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {state.query ? `"${state.query}"` : "Commands"}
      </p>
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd, i) => (
          <button
            key={cmd.label}
            ref={(el) => { itemRefs.current[i] = el; }}
            onClick={() => executeCommand(cmd)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left",
              i === selectedIndex
                ? "bg-panel-hover text-foreground"
                : "text-muted-foreground hover:bg-panel-hover hover:text-foreground"
            )}
          >
            <span className="shrink-0 text-muted-foreground">{cmd.icon}</span>
            <span className="font-medium">{cmd.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
