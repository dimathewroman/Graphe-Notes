import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableHeader, TableCell } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { useAppStore } from "@/store";
import {
  useGetNote, useUpdateNote, useDeleteNote, useToggleNotePin, useToggleNoteFavorite,
  useToggleNoteVault,
  getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListTodo, Quote, Code, Heading1, Heading2, Heading3,
  Image as ImageIcon, Trash2, Pin, Star, PanelLeft, FileText,
  Lock, ShieldCheck, Table as TableIcon, RowsIcon, Plus, X, Hash,
  Sparkles, Loader2, Check, RotateCcw, Wand2, BookOpen, Scissors,
  Link2, Unlink, ChevronRight, ArrowUp, ArrowDown, MessageSquare, ListChecks,
  Undo2, Redo2, Clock, ArrowLeft, Menu, MoreHorizontal, PanelLeftClose
} from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { cn, formatDate } from "@/lib/utils";
import { VaultModal } from "./VaultModal";
import { useBreakpoint } from "@/hooks/use-mobile";

// Custom floating AI menu that appears on text selection (Tiptap v3 compatible)

type PresetOption = { id: string; label: string };

type SubAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  presets?: PresetOption[];
};

type ActionGroup = {
  label: string;
  icon: React.ReactNode;
  actions: SubAction[];
};

const actionGroups: ActionGroup[] = [
  {
    label: "Adjust Length",
    icon: <Scissors className="w-3 h-3" />,
    actions: [
      {
        id: "shorter",
        label: "Shorter",
        icon: <ArrowDown className="w-3 h-3" />,
        presets: [
          { id: "shorter_25", label: "25% shorter" },
          { id: "shorter_50", label: "50% shorter" },
          { id: "shorter_custom", label: "Custom" },
        ],
      },
      {
        id: "longer",
        label: "Longer",
        icon: <ArrowUp className="w-3 h-3" />,
        presets: [
          { id: "longer_25", label: "25% longer" },
          { id: "longer_50", label: "50% longer" },
          { id: "longer_custom", label: "Custom" },
        ],
      },
    ],
  },
  {
    label: "Improve Writing",
    icon: <Wand2 className="w-3 h-3" />,
    actions: [
      { id: "proofread", label: "Proofread", icon: <Check className="w-3 h-3" /> },
      { id: "simplify", label: "Simplify", icon: <BookOpen className="w-3 h-3" /> },
      { id: "improve", label: "Improve", icon: <Wand2 className="w-3 h-3" /> },
    ],
  },
  {
    label: "Transform",
    icon: <RotateCcw className="w-3 h-3" />,
    actions: [
      { id: "rewrite", label: "Rewrite", icon: <RotateCcw className="w-3 h-3" /> },
      {
        id: "tone",
        label: "Change Tone",
        icon: <MessageSquare className="w-3 h-3" />,
        presets: [
          { id: "tone_casual", label: "Casual" },
          { id: "tone_professional", label: "Professional" },
          { id: "tone_friendly", label: "Friendly" },
          { id: "tone_direct", label: "Direct" },
          { id: "tone_custom", label: "Custom" },
        ],
      },
      {
        id: "summarize",
        label: "Summarize",
        icon: <BookOpen className="w-3 h-3" />,
        presets: [
          { id: "summarize_short", label: "Short (1–2 sentences)" },
          { id: "summarize_balanced", label: "Balanced (short paragraph)" },
          { id: "summarize_detailed", label: "Detailed (bullet points)" },
          { id: "summarize_custom", label: "Custom" },
        ],
      },
      { id: "extract_action_items", label: "Extract Action Items", icon: <ListChecks className="w-3 h-3" /> },
    ],
  },
];

function AiSelectionMenu({
  editor,
  visible,
  onAction,
  onSelectionCapture,
}: {
  editor: ReturnType<typeof useEditor>;
  visible: boolean;
  onAction: (action: string, customInstruction?: string) => void;
  onSelectionCapture: (from: number, to: number, text: string) => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [customInputFor, setCustomInputFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      setExpandedGroup(null);
      setExpandedAction(null);
      setCustomInputFor(null);
      setCustomText("");
    }
  }, [visible]);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      if (!visible) { setRect(null); return; }
      const { from, to } = editor.state.selection;
      if (from === to) { setRect(null); return; }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) { setRect(null); return; }
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width === 0) { setRect(null); return; }
      setRect(r);
      // Capture the selection range NOW — before any menu interaction can
      // disturb the editor's active selection.
      const text = editor.state.doc.textBetween(from, to);
      onSelectionCapture(from, to, text);
    };

    const handleBlur = () => setTimeout(() => setRect(null), 150);

    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    editor.on("blur", handleBlur);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
      editor.off("blur", handleBlur);
    };
  }, [editor, visible, onSelectionCapture]);

  if (!rect || !visible) return null;

  const resetMenu = () => {
    setExpandedGroup(null);
    setExpandedAction(null);
    setCustomInputFor(null);
    setCustomText("");
  };

  const handlePresetClick = (presetId: string) => {
    if (presetId.endsWith("_custom")) {
      setCustomInputFor(presetId);
      setCustomText("");
    } else {
      onAction(presetId);
      resetMenu();
    }
  };

  const handleCustomSubmit = (baseActionId: string) => {
    if (customText.trim()) {
      onAction(baseActionId, customText.trim());
      resetMenu();
    }
  };

  const isMobile = window.innerWidth < 768;

  const menuStyle = useMemo(() => {
    if (!rect) return {};
    const pad = 8;
    const vw = window.innerWidth;
    const menuW = isMobile ? vw - pad * 2 : 420;
    let left: number;
    let top: number;

    if (isMobile) {
      left = pad;
      top = rect.bottom + 8;
      if (top + 200 > window.innerHeight) {
        top = rect.top - 52;
      }
    } else {
      left = rect.left + rect.width / 2 - menuW / 2;
      top = rect.top - 44;
      if (left + menuW > vw - pad) left = vw - menuW - pad;
      if (left < pad) left = pad;
      if (top < pad) top = rect.bottom + 8;
    }

    return { top, left, width: isMobile ? `calc(100vw - ${pad * 2}px)` : undefined };
  }, [rect, isMobile]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 pointer-events-auto"
      style={menuStyle}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={cn(
        "bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1",
        isMobile ? "flex flex-wrap items-center gap-0.5" : "flex items-center gap-0.5"
      )}>
        <span className="text-xs text-muted-foreground px-2 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          AI
        </span>
        <div className={cn("bg-panel-border", isMobile ? "w-full h-px my-0.5" : "w-px h-4")} />

        {actionGroups.map((group) => (
          <div key={group.label} className="relative">
            <button
              onClick={() => {
                setExpandedGroup(expandedGroup === group.label ? null : group.label);
                setExpandedAction(null);
                setCustomInputFor(null);
                setCustomText("");
              }}
              onMouseEnter={() => {
                if (!isMobile) {
                  setExpandedGroup(group.label);
                  setExpandedAction(null);
                  setCustomInputFor(null);
                  setCustomText("");
                }
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors min-h-[36px]",
                expandedGroup === group.label
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400"
              )}
            >
              {group.icon}
              {!isMobile && group.label}
              <ChevronRight className={cn("w-3 h-3 transition-transform", expandedGroup === group.label && "rotate-90")} />
            </button>

            {expandedGroup === group.label && (
              <div
                className={cn(
                  "bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1 min-w-[160px] z-50",
                  isMobile ? "fixed left-2 right-2 mt-1" : "absolute top-full left-0 mt-1"
                )}
                style={isMobile ? { top: (menuRef.current?.getBoundingClientRect().bottom ?? 0) + 4 } : undefined}
                onMouseLeave={() => {
                  if (!isMobile && !expandedAction && !customInputFor) {
                    setExpandedGroup(null);
                  }
                }}
              >
                {group.actions.map((action) => (
                  <div key={action.id} className="relative">
                    {action.presets ? (
                      <>
                        <button
                          onClick={() => {
                            setExpandedAction(expandedAction === action.id ? null : action.id);
                            setCustomInputFor(null);
                            setCustomText("");
                          }}
                          onMouseEnter={() => {
                            if (!isMobile) {
                              setExpandedAction(action.id);
                              setCustomInputFor(null);
                              setCustomText("");
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs transition-colors min-h-[36px]",
                            expandedAction === action.id
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {action.icon}
                            {action.label}
                          </span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        {expandedAction === action.id && (
                          <div className={cn(
                            "bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1 min-w-[180px] z-50",
                            isMobile ? "pl-4 border-l border-t-0 border-r-0 border-b-0 rounded-none shadow-none" : "absolute left-full top-0 ml-1"
                          )}>
                            {action.presets.map((preset) => (
                              <div key={preset.id}>
                                {customInputFor === preset.id ? (
                                  <div className="flex items-center gap-1 px-1 py-1">
                                    <input
                                      type="text"
                                      value={customText}
                                      onChange={(e) => setCustomText(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(preset.id); }}
                                      placeholder="Type instruction..."
                                      className="flex-1 bg-transparent border border-panel-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 min-w-[120px]"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleCustomSubmit(preset.id)}
                                      className="p-1 rounded hover:bg-indigo-500/10 text-indigo-400"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handlePresetClick(preset.id)}
                                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors whitespace-nowrap min-h-[36px]"
                                  >
                                    {preset.label}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          onAction(action.id);
                          resetMenu();
                        }}
                        className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors whitespace-nowrap min-h-[36px]"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Smart Checklist Extension ──────────────────────────────────────────────
// Extends TaskItem with:
//   • collapsed attribute  → hides nested sub-lists when checked
//   • appendTransaction    → auto-sort checked sub-items to bottom of their list
//                          → uncheck parent resets all child items
const smartChecklistKey = new PluginKey("smartChecklist");

const SmartTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      collapsed: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-collapsed") === "true",
        renderHTML: (attrs) =>
          attrs.collapsed ? { "data-collapsed": "true" } : {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: smartChecklistKey,
        appendTransaction(transactions, oldState, newState) {
          if (transactions.some((t) => t.getMeta(smartChecklistKey))) return null;
          const mainTr = transactions.find((t) => t.docChanged);
          if (!mainTr) return null;

          // Find the first taskItem whose checked state just changed
          let changedPos: number | null = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let changedNode: any = null;
          let wasChecked = false;

          newState.doc.descendants((node, pos) => {
            if (changedPos !== null) return false;
            if (node.type.name !== "taskItem") return true;
            const oldPos = mainTr.mapping.invert().map(pos);
            const oldNode = oldState.doc.nodeAt(oldPos);
            if (oldNode?.type.name !== "taskItem") return true;
            if ((oldNode.attrs.checked as boolean) === (node.attrs.checked as boolean)) return true;
            changedPos = pos;
            changedNode = node;
            wasChecked = oldNode.attrs.checked as boolean;
            return false;
          });

          if (changedPos === null || !changedNode) return null;

          let tr = newState.tr;
          let modified = false;
          const pos = changedPos;
          const node = changedNode;
          const isNowChecked = node.attrs.checked as boolean;

          if (isNowChecked) {
            // ── CHECKED ──────────────────────────────────────────
            // 1. Collapse any nested taskList
            let hasNestedList = false;
            node.forEach((child: { type: { name: string } }) => {
              if (child.type.name === "taskList") hasNestedList = true;
            });
            if (hasNestedList) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, collapsed: true });
              modified = true;
            }

            // 2. Sort to bottom of parent list if this is a sub-item
            const $pos = newState.doc.resolve(pos);
            if ($pos.depth >= 2) {
              const parentList = $pos.node($pos.depth - 1);
              const grandparent = $pos.node($pos.depth - 2);
              if (
                parentList.type.name === "taskList" &&
                grandparent.type.name === "taskItem"
              ) {
                const parentListEnd = $pos.end($pos.depth - 1);
                const currentNode = tr.doc.nodeAt(pos);
                if (currentNode) {
                  const nodeSize = currentNode.nodeSize;
                  if (pos + nodeSize < parentListEnd) {
                    const slice = tr.doc.slice(pos, pos + nodeSize);
                    tr = tr.delete(pos, pos + nodeSize);
                    tr = tr.insert(parentListEnd - nodeSize, slice.content);
                    modified = true;
                  }
                }
              }
            }
          } else {
            // ── UNCHECKED ─────────────────────────────────────────
            // 1. Expand collapsed nested list
            if (node.attrs.collapsed) {
              tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, collapsed: false });
              modified = true;
            }
            // 2. Reset all nested taskItem children to unchecked
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            node.descendants((child: any, childOffset: number) => {
              if (child.type.name === "taskItem" && child.attrs.checked) {
                tr = tr.setNodeMarkup(pos + 1 + childOffset, undefined, {
                  ...child.attrs,
                  checked: false,
                  collapsed: false,
                });
                modified = true;
              }
              return true;
            });
          }

          if (modified) {
            tr.setMeta(smartChecklistKey, true);
            return tr;
          }
          return null;
        },
      }),
    ];
  },
});

function ScrollableToolbar({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  return (
    <div className="relative border-b border-panel-border shrink-0">
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/80 to-transparent z-10 pointer-events-none" />
      )}
      <div
        ref={scrollRef}
        className="flex items-center gap-0.5 p-1.5 md:p-2 overflow-x-auto bg-panel/30 hide-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/80 to-transparent z-10 pointer-events-none" />
      )}
    </div>
  );
}

export function NoteEditor() {
  const { selectedNoteId, selectNote, isSidebarOpen, toggleSidebar, isNoteListOpen, toggleNoteList, setMobileView, setSidebarOpen } = useAppStore();
  const bp = useBreakpoint();
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note, isLoading } = useGetNote(selectedNoteId || 0, { query: { enabled: !!selectedNoteId } as any });

  const updateNoteMut = useUpdateNote();
  const deleteNoteMut = useDeleteNote();
  const pinMut = useToggleNotePin();
  const favMut = useToggleNoteFavorite();
  const vaultMut = useToggleNoteVault();
  const { isVaultUnlocked } = useAppStore();

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const [linkPopover, setLinkPopover] = useState<{ visible: boolean; url: string }>({ visible: false, url: "" });
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!linkPopover.visible) return;
    const handle = (e: MouseEvent) => {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
        setLinkPopover({ visible: false, url: "" });
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [linkPopover.visible]);

  // AI bubble menu state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Store the selection range the moment the toolbar appears, before any
  // menu interaction can disturb the editor's active selection.
  const savedAiSelection = useRef<{ from: number; to: number; text: string } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false }),
      UnderlineExt,
      TextStyle,
      Color,
      FontFamily,
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Start writing..." }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      TaskList,
      SmartTaskItem.configure({ nested: true }),
    ],
    content: note?.content || "",
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getHTML(), editor.getText());
    },
    editorProps: {
      attributes: { class: "prose prose-invert max-w-none focus:outline-none" },
    },
  }, [selectedNoteId]);

  useEffect(() => {
    if (note && editor) {
      setTitle(note.title);
      if (editor.getHTML() !== note.content) {
        editor.commands.setContent(note.content, { emitUpdate: false });
      }
    }
    setShowVersionHistory(false);
  }, [note?.id, editor]);

  const debouncedSave = useCallback(
    (() => {
      let timeout: ReturnType<typeof setTimeout>;
      return (id: number, data: any) => {
        setSaveStatus("saving");
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          await updateNoteMut.mutateAsync({ id, data });
          queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
          setSaveStatus("saved");
          // Fire-and-forget version snapshot (server enforces 5-min interval)
          fetch(`/api/notes/${id}/versions`, { method: "POST" }).catch(() => {});
        }, 800);
      };
    })(),
    []
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (selectedNoteId) debouncedSave(selectedNoteId, { title: newTitle });
  };

  const handleContentChange = (html: string, text: string) => {
    if (selectedNoteId) debouncedSave(selectedNoteId, { content: html, contentText: text });
  };

  const handleRestoreVersion = useCallback((content: string, restoredTitle: string) => {
    if (!editor || !selectedNoteId) return;
    editor.commands.setContent(content, { emitUpdate: false });
    setTitle(restoredTitle);
    debouncedSave(selectedNoteId, { content, title: restoredTitle, contentText: editor.getText() });
  }, [editor, selectedNoteId, debouncedSave]);

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (confirm("Are you sure you want to delete this note?")) {
      await deleteNoteMut.mutateAsync({ id: selectedNoteId });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectNote(null);
      if (bp !== "desktop") setMobileView("list");
    }
  };

  const handleAction = async (action: "pin" | "fav") => {
    if (!selectedNoteId) return;
    if (action === "pin") await pinMut.mutateAsync({ id: selectedNoteId });
    if (action === "fav") await favMut.mutateAsync({ id: selectedNoteId });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleToggleVault = async () => {
    if (!selectedNoteId || !note) return;
    await vaultMut.mutateAsync({ id: selectedNoteId, data: { vaulted: !note.vaulted } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  // Tags
  const addTag = async () => {
    if (!selectedNoteId || !note) return;
    const tag = tagInput.trim().replace(/^#/, "");
    if (!tag || note.tags.includes(tag)) { setTagInput(""); setShowTagInput(false); return; }
    const newTags = [...note.tags, tag];
    await updateNoteMut.mutateAsync({ id: selectedNoteId, data: { tags: newTags } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
    setTagInput("");
    setShowTagInput(false);
  };

  const removeTag = async (tag: string) => {
    if (!selectedNoteId || !note) return;
    const newTags = note.tags.filter(t => t !== tag);
    await updateNoteMut.mutateAsync({ id: selectedNoteId, data: { tags: newTags } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
  };

  // Link helpers
  const openLinkPopover = () => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href || "";
    setLinkPopover({ visible: true, url: existing });
    setTimeout(() => linkInputRef.current?.focus(), 30);
  };

  const applyLink = () => {
    if (!editor) return;
    const trimmed = linkPopover.url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkPopover({ visible: false, url: "" });
  };

  // AI writing tools for selected text
  const callAI = async (action: string, customInstruction?: string) => {
    if (!editor) return;

    // Use the selection that was captured when the toolbar first appeared.
    // Falling back to the current editor state handles edge cases where the
    // toolbar fires without a prior capture.
    const sel = savedAiSelection.current ?? (() => {
      const { from, to } = editor.state.selection;
      return { from, to, text: editor.state.doc.textBetween(from, to) };
    })();

    if (!sel.text.trim()) return;

    const apiKey = (localStorage.getItem("ai_api_key") || "").trim();
    const provider = (localStorage.getItem("ai_provider") || "openai") as "openai" | "anthropic" | "google";
    const PROVIDER_ID_PREFIX: Record<string, string> = {
      openai: "gpt-|o1|o3|chatgpt",
      anthropic: "claude-",
      google: "gemini-",
    };
    const storedModel = localStorage.getItem("ai_model") || "";
    const prefixPattern = PROVIDER_ID_PREFIX[provider] ?? "";
    const modelLooksValid = prefixPattern
      ? prefixPattern.split("|").some((p) => storedModel.startsWith(p))
      : !!storedModel;

    // If stored model looks invalid, fetch the real list from the user's account
    let model = storedModel;
    if (!modelLooksValid && apiKey) {
      try {
        const params = new URLSearchParams({ provider, apiKey });
        const r = await fetch(`/api/models?${params}`);
        if (r.ok) {
          const d = await r.json() as { models: string[]; source: string };
          if (d.source === "live" && d.models?.length) {
            // Cache the live result and heal the saved model
            localStorage.setItem(`ai_models_${provider}`, JSON.stringify(d.models));
            localStorage.setItem(`ai_models_${provider}_at`, String(Date.now()));
            model = d.models[0];
            localStorage.setItem("ai_model", model);
          }
        }
      } catch { /* ignore */ }

      if (!model || model === storedModel) {
        setAiError("Your model setting is invalid. Open Settings → AI, let the model list load, select a model, and save.");
        setTimeout(() => setAiError(null), 7000);
        setAiLoading(false);
        return;
      }
    }

    if (!apiKey) {
      setAiError("No AI API key configured. Open Settings → AI to add one.");
      setTimeout(() => setAiError(null), 4000);
      return;
    }

    setAiLoading(true);
    setAiError(null);

    const selected = sel.text;
    const prompts: Record<string, string> = {
      shorter_25: `Make the following text approximately 25% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${selected}`,
      shorter_50: `Make the following text approximately 50% shorter while preserving key meaning. Return only the shortened text, no explanations:\n\n${selected}`,
      shorter_custom: `Make the following text shorter. Additional instruction: ${customInstruction || ""}. Return only the shortened text, no explanations:\n\n${selected}`,
      longer_25: `Expand the following text by approximately 25% with more detail and context. Return only the expanded text, no explanations:\n\n${selected}`,
      longer_50: `Expand the following text by approximately 50% with more detail and context. Return only the expanded text, no explanations:\n\n${selected}`,
      longer_custom: `Expand the following text. Additional instruction: ${customInstruction || ""}. Return only the expanded text, no explanations:\n\n${selected}`,
      proofread: `Proofread and fix grammar, spelling, and punctuation in the following text. Do not change wording or structure. Return only the corrected text, no explanations:\n\n${selected}`,
      simplify: `Rewrite the following text using shorter sentences and simpler vocabulary. Keep the same length and meaning. Return only the simplified text, no explanations:\n\n${selected}`,
      improve: `Enhance the clarity, flow, and word choice of the following text while preserving its original meaning. Return only the improved text, no explanations:\n\n${selected}`,
      rewrite: `Completely rephrase the following text while preserving its core meaning. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_casual: `Rewrite the following text in a casual tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_professional: `Rewrite the following text in a professional tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_friendly: `Rewrite the following text in a friendly tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_direct: `Rewrite the following text in a direct tone. Return only the rewritten text, no explanations:\n\n${selected}`,
      tone_custom: `Rewrite the following text with the following tone/style: ${customInstruction || ""}. Return only the rewritten text, no explanations:\n\n${selected}`,
      summarize_short: `Summarize the following text in 1-2 sentences. Return only the summary, no explanations:\n\n${selected}`,
      summarize_balanced: `Summarize the following text in a short paragraph. Return only the summary, no explanations:\n\n${selected}`,
      summarize_detailed: `Summarize the following text as detailed bullet points. Return only the bullet-point summary, no explanations:\n\n${selected}`,
      summarize_custom: `Summarize the following text. Additional instruction: ${customInstruction || ""}. Return only the summary, no explanations:\n\n${selected}`,
      extract_action_items: `Extract all action items, tasks, and to-dos from the following text. Return them as a bulleted list. If no action items are found, return "No action items found.", no explanations:\n\n${selected}`,
    };

    const prompt = prompts[action];
    if (!prompt) { setAiLoading(false); return; }

    try {
      const res = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, prompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const result: string = data.result || "";
      if (result) {
        // Replace the saved selection range directly in the document.
        editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, result).run();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      setAiError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
      savedAiSelection.current = null;
    }
  };

  const handleBack = () => {
    setMobileView("list");
    selectNote(null);
  };

  if (!selectedNoteId) {
    if (bp === "mobile") return null;
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground relative">
        <FileText className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-medium mb-2 text-foreground/80">Select a note</h2>
        <p className="text-sm">Choose a note from the list or create a new one to start writing.</p>
      </div>
    );
  }

  if (isLoading || !editor) {
    return <div className="flex-1 flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (note?.vaulted && !isVaultUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-medium text-foreground/80">This note is in the vault</h2>
        <p className="text-sm">Unlock the vault from the sidebar to view this note.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden relative">
      {/* Top Header */}
      <header className="h-14 border-b border-panel-border flex items-center justify-between px-2 md:px-4 shrink-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {bp === "mobile" && (
            <button onClick={handleBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
            <div className="flex items-center gap-0.5 mr-2">
              {!isSidebarOpen && (
                <IconButton onClick={toggleSidebar} title="Show sidebar">
                  <PanelLeft className="w-4 h-4" />
                </IconButton>
              )}
              {!isNoteListOpen && (
                <IconButton onClick={toggleNoteList} title="Show note list">
                  <PanelLeftClose className="w-4 h-4 scale-x-[-1]" />
                </IconButton>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", saveStatus === "saved" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
            {saveStatus === "saved" ? "Saved" : "Saving..."}
            {bp === "desktop" && note && <span className="ml-2 border-l border-panel-border pl-2">Updated {formatDate(note.updatedAt)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          <IconButton onClick={() => handleAction("pin")} active={note?.pinned} title="Pin Note">
            <Pin className={cn("w-4 h-4", note?.pinned && "fill-current")} />
          </IconButton>
          <IconButton onClick={() => handleAction("fav")} active={note?.favorite} title="Favorite">
            <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
          </IconButton>
          {bp === "desktop" && (
            <>
              <IconButton
                onClick={handleToggleVault}
                active={note?.vaulted}
                title={note?.vaulted ? "Remove from vault" : "Move to vault"}
                className={note?.vaulted ? "text-indigo-400" : ""}
              >
                <ShieldCheck className={cn("w-4 h-4", note?.vaulted && "fill-current")} />
              </IconButton>
              <IconButton
                onClick={() => setShowVersionHistory(v => !v)}
                active={showVersionHistory}
                title="Version history"
              >
                <Clock className="w-4 h-4" />
              </IconButton>
            </>
          )}
          {bp !== "desktop" && (
            <OverflowMenu
              note={note}
              onVaultToggle={handleToggleVault}
              onVersionHistory={() => setShowVersionHistory(v => !v)}
              onDelete={handleDelete}
              showVersionHistory={showVersionHistory}
            />
          )}
          {bp === "desktop" && (
            <>
              <div className="w-px h-4 bg-panel-border mx-1" />
              <IconButton onClick={handleDelete} className="hover:text-destructive hover:bg-destructive/10" title="Delete">
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <ScrollableToolbar>
        <ToolbarButton
          command={() => editor.chain().focus().undo().run()}
          active={false}
          disabled={!editor.can().undo()}
          icon={<Undo2 className="w-4 h-4" />}
          title="Undo (Ctrl+Z)"
        />
        <ToolbarButton
          command={() => editor.chain().focus().redo().run()}
          active={false}
          disabled={!editor.can().redo()}
          icon={<Redo2 className="w-4 h-4" />}
          title="Redo (Ctrl+Shift+Z)"
        />

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        <ToolbarButton command={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} icon={<Bold className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} icon={<Italic className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} icon={<UnderlineIcon className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} icon={<Strikethrough className="w-4 h-4" />} />

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        <ToolbarButton command={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} icon={<Heading1 className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} icon={<Heading2 className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} icon={<Heading3 className="w-4 h-4" />} />

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        <ToolbarButton command={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} icon={<AlignLeft className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} icon={<AlignCenter className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} icon={<AlignRight className="w-4 h-4" />} />

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        <ToolbarButton command={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} icon={<List className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} icon={<ListOrdered className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} icon={<ListTodo className="w-4 h-4" />} title="Checklist" />
        <ToolbarButton command={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} icon={<Quote className="w-4 h-4" />} />
        <ToolbarButton command={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} icon={<Code className="w-4 h-4" />} />

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        {/* Table controls */}
        <ToolbarButton
          command={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          active={false}
          icon={<TableIcon className="w-4 h-4" />}
          title="Insert table"
        />
        {editor.isActive("table") && (
          <>
            <ToolbarButton command={() => editor.chain().focus().addRowAfter().run()} active={false} icon={<RowsIcon className="w-4 h-4" />} title="Add row" />
            <ToolbarButton command={() => editor.chain().focus().deleteRow().run()} active={false} icon={<Scissors className="w-4 h-4" />} title="Delete row" />
            <ToolbarButton command={() => editor.chain().focus().deleteTable().run()} active={false} icon={<X className="w-4 h-4" />} title="Delete table" />
          </>
        )}

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        <ToolbarButton
          command={() => {
            const url = window.prompt("Image URL");
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          active={false}
          icon={<ImageIcon className="w-4 h-4" />}
          title="Insert image"
        />

        <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

        {/* Link button with inline popover */}
        <div className="relative shrink-0">
          <ToolbarButton
            command={openLinkPopover}
            active={editor.isActive("link")}
            icon={<Link2 className="w-4 h-4" />}
            title="Insert / edit link (Ctrl+K)"
          />
          {linkPopover.visible && (
            <div
              ref={linkPopoverRef}
              className="absolute top-full left-0 mt-1.5 z-30 flex items-center gap-1.5 bg-popover border border-panel-border rounded-xl shadow-xl px-3 py-2 min-w-[280px]"
            >
              <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                ref={linkInputRef}
                type="text"
                placeholder="https://example.com"
                value={linkPopover.url}
                onChange={(e) => setLinkPopover((p) => ({ ...p, url: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                  if (e.key === "Escape") setLinkPopover({ visible: false, url: "" });
                  e.stopPropagation();
                }}
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/60 min-w-0"
              />
              {editor.isActive("link") && (
                <button
                  onClick={() => { editor.chain().focus().unsetLink().run(); setLinkPopover({ visible: false, url: "" }); }}
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
            </div>
          )}
        </div>
      </ScrollableToolbar>

      {/* AI Bubble Menu – custom floating menu on text selection */}
      <AiSelectionMenu
        editor={editor}
        visible={!aiLoading}
        onAction={callAI}
        onSelectionCapture={(from, to, text) => {
          savedAiSelection.current = { from, to, text };
        }}
      />

      {/* AI Loading / Error indicator */}
      {(aiLoading || aiError) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          {aiLoading ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-indigo-500/30 rounded-full shadow-xl text-indigo-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">AI is rewriting…</span>
            </div>
          ) : aiError ? (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-popover border border-destructive/30 rounded-full shadow-xl text-destructive pointer-events-auto">
              <X className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{aiError}</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note Title"
            className="w-full text-2xl md:text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
          />

          {/* Tags Row */}
          <div className="flex items-center flex-wrap gap-1.5 mb-8">
            {note?.tags.map(tag => (
              <span key={tag} className="group flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 border border-primary/20 text-primary">
                <Hash className="w-2.5 h-2.5" />
                {tag}
                <button onClick={() => removeTag(tag)} className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all ml-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {showTagInput ? (
              <form onSubmit={(e) => { e.preventDefault(); addTag(); }} className="flex items-center gap-1">
                <input
                  ref={tagInputRef}
                  autoFocus
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onBlur={() => { if (!tagInput) setShowTagInput(false); }}
                  placeholder="tag name..."
                  className="text-xs bg-background border border-primary/30 rounded-full px-2.5 py-1 outline-none focus:border-primary text-foreground w-24"
                />
              </form>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-panel-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                Add tag
              </button>
            )}
          </div>

          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Version History Panel */}
      {showVersionHistory && selectedNoteId && (
        <VersionHistoryPanel
          noteId={selectedNoteId}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

    </div>
  );
}

function OverflowMenu({ note, onVaultToggle, onVersionHistory, onDelete, showVersionHistory }: {
  note: { vaulted: boolean } | null | undefined;
  onVaultToggle: () => void;
  onVersionHistory: () => void;
  onDelete: () => void;
  showVersionHistory: boolean;
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
      <IconButton onClick={() => setOpen(!open)}>
        <MoreHorizontal className="w-4 h-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-popover border border-panel-border rounded-xl shadow-2xl py-1">
          <button onClick={() => { onVaultToggle(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
            <ShieldCheck className="w-4 h-4" />
            {note?.vaulted ? "Remove from Vault" : "Move to Vault"}
          </button>
          <button onClick={() => { onVersionHistory(); setOpen(false); }} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-panel transition-colors", showVersionHistory ? "text-primary" : "text-foreground")}>
            <Clock className="w-4 h-4" />
            Version History
          </button>
          <div className="h-px bg-panel-border mx-2 my-1" />
          <button onClick={() => { onDelete(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ command, active, icon, title, disabled }: { command: () => void; active: boolean; icon: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button
      onClick={command}
      title={title}
      disabled={disabled}
      className={cn(
        "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex items-center justify-center",
        active && "bg-panel text-primary",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none"
      )}
    >
      {icon}
    </button>
  );
}
