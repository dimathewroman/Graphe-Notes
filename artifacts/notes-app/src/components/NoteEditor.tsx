import { useEffect, useState, useCallback, useRef } from "react";
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
  useLockNote, useUnlockNote,
  getGetNotesQueryKey, getGetNoteQueryKey, getGetTagsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, ListTodo, Quote, Code, Heading1, Heading2, Heading3,
  Image as ImageIcon, Trash2, Pin, Star, PanelLeft, FileText,
  Lock, Unlock, Table as TableIcon, RowsIcon, Plus, X, Hash,
  Sparkles, Loader2, Check, RotateCcw, Wand2, BookOpen, Scissors,
  Link2, Unlink, ChevronRight, ArrowUp, ArrowDown, MessageSquare, ListChecks
} from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { cn, formatDate } from "@/lib/utils";
import { LockModal } from "./LockModal";

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
}: {
  editor: ReturnType<typeof useEditor>;
  visible: boolean;
  onAction: (action: string, customInstruction?: string) => void;
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
  }, [editor, visible]);

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

  const toolbarTop = rect.top - 44 + window.scrollY;
  const toolbarLeft = rect.left + rect.width / 2;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 pointer-events-auto"
      style={{ top: toolbarTop, left: toolbarLeft, transform: "translateX(-50%)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1">
        <span className="text-xs text-muted-foreground px-2 font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          AI
        </span>
        <div className="w-px h-4 bg-panel-border" />

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
                setExpandedGroup(group.label);
                setExpandedAction(null);
                setCustomInputFor(null);
                setCustomText("");
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors",
                expandedGroup === group.label
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400"
              )}
            >
              {group.icon}
              {group.label}
              <ChevronRight className={cn("w-3 h-3 transition-transform", expandedGroup === group.label && "rotate-90")} />
            </button>

            {expandedGroup === group.label && (
              <div
                className="absolute top-full left-0 mt-1 bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1 min-w-[160px] z-50"
                onMouseLeave={() => {
                  if (!expandedAction && !customInputFor) {
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
                            setExpandedAction(action.id);
                            setCustomInputFor(null);
                            setCustomText("");
                          }}
                          className={cn(
                            "flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs transition-colors",
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
                          <div className="absolute left-full top-0 ml-1 bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1 min-w-[180px] z-50">
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
                                    className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors whitespace-nowrap"
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
                        className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors whitespace-nowrap"
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

export function NoteEditor() {
  const { selectedNoteId, selectNote, isSidebarOpen, toggleSidebar } = useAppStore();
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note, isLoading } = useGetNote(selectedNoteId || 0, { query: { enabled: !!selectedNoteId } as any });

  const updateNoteMut = useUpdateNote();
  const deleteNoteMut = useDeleteNote();
  const pinMut = useToggleNotePin();
  const favMut = useToggleNoteFavorite();
  const lockMut = useLockNote();
  const unlockMut = useUnlockNote();

  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [lockModal, setLockModal] = useState<"set" | "verify" | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
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
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiSelectedText, setAiSelectedText] = useState("");

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
    setIsUnlocked(false);
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

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (confirm("Are you sure you want to delete this note?")) {
      await deleteNoteMut.mutateAsync({ id: selectedNoteId });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectNote(null);
    }
  };

  const handleAction = async (action: "pin" | "fav") => {
    if (!selectedNoteId) return;
    if (action === "pin") await pinMut.mutateAsync({ id: selectedNoteId });
    if (action === "fav") await favMut.mutateAsync({ id: selectedNoteId });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleLockSet = async (hash: string) => {
    if (!selectedNoteId) return;
    await lockMut.mutateAsync({ id: selectedNoteId, data: { passwordHash: hash } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    setLockModal(null);
  };

  const handleLockVerify = async (hash: string) => {
    if (!note) return;
    if (note.lockPasswordHash === hash) {
      setIsUnlocked(true);
      setLockModal(null);
    } else {
      alert("Incorrect password.");
    }
  };

  const handleUnlockFully = async () => {
    if (!selectedNoteId) return;
    await unlockMut.mutateAsync({ id: selectedNoteId });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    setIsUnlocked(false);
    setLockModal(null);
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
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to);
    if (!selected.trim()) return;

    const apiKey = localStorage.getItem("ai_api_key") || "";
    const provider = (localStorage.getItem("ai_provider") || "openai") as any;
    const model = localStorage.getItem("ai_model") || "gpt-4o-mini";

    if (!apiKey) { alert("Please configure your AI API key in Settings first."); return; }

    setAiLoading(true);
    setAiSelectedText(selected);
    setAiPreview(null);

    const prompts: Record<string, string> = {
      shorter_25: `Make the following text approximately 25% shorter while preserving key meaning. Return only the shortened text:\n\n${selected}`,
      shorter_50: `Make the following text approximately 50% shorter while preserving key meaning. Return only the shortened text:\n\n${selected}`,
      shorter_custom: `Make the following text shorter. Additional instruction: ${customInstruction || ""}. Return only the shortened text:\n\n${selected}`,
      longer_25: `Expand the following text by approximately 25% with more detail and context. Return only the expanded text:\n\n${selected}`,
      longer_50: `Expand the following text by approximately 50% with more detail and context. Return only the expanded text:\n\n${selected}`,
      longer_custom: `Expand the following text. Additional instruction: ${customInstruction || ""}. Return only the expanded text:\n\n${selected}`,
      proofread: `Proofread and fix grammar, spelling, and punctuation in the following text. Do not change wording or structure. Return only the corrected text, no explanations:\n\n${selected}`,
      simplify: `Rewrite the following text using shorter sentences and simpler vocabulary. Keep the same length and meaning. Return only the simplified text:\n\n${selected}`,
      improve: `Enhance the clarity, flow, and word choice of the following text while preserving its original meaning. Return only the improved text:\n\n${selected}`,
      rewrite: `Completely rephrase the following text while preserving its core meaning. Return only the rewritten text:\n\n${selected}`,
      tone_casual: `Rewrite the following text in a casual tone. Return only the rewritten text:\n\n${selected}`,
      tone_professional: `Rewrite the following text in a professional tone. Return only the rewritten text:\n\n${selected}`,
      tone_friendly: `Rewrite the following text in a friendly tone. Return only the rewritten text:\n\n${selected}`,
      tone_direct: `Rewrite the following text in a direct tone. Return only the rewritten text:\n\n${selected}`,
      tone_custom: `Rewrite the following text with the following tone/style: ${customInstruction || ""}. Return only the rewritten text:\n\n${selected}`,
      summarize_short: `Summarize the following text in 1-2 sentences. Return only the summary:\n\n${selected}`,
      summarize_balanced: `Summarize the following text in a short paragraph. Return only the summary:\n\n${selected}`,
      summarize_detailed: `Summarize the following text as detailed bullet points. Return only the bullet-point summary:\n\n${selected}`,
      summarize_custom: `Summarize the following text. Additional instruction: ${customInstruction || ""}. Return only the summary:\n\n${selected}`,
      extract_action_items: `Extract all action items, tasks, and to-dos from the following text. Return them as a bulleted list. If no action items are found, return "No action items found.":\n\n${selected}`,
    };

    const prompt = prompts[action];
    if (!prompt) return;

    try {
      const res = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, prompt })
      });
      const data = await res.json();
      setAiPreview(data.result || "");
    } catch {
      setAiPreview("Error contacting AI. Please check your settings.");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiPreview = () => {
    if (!editor || !aiPreview) return;
    editor.chain().focus().insertContentAt(editor.state.selection, aiPreview).run();
    setAiPreview(null);
    setAiSelectedText("");
  };

  const dismissAiPreview = () => {
    setAiPreview(null);
    setAiSelectedText("");
  };

  if (!selectedNoteId) {
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

  // Show lock screen for locked + not-yet-unlocked notes
  if (note?.locked && !isUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-medium text-foreground/80">This note is locked</h2>
        <p className="text-sm">Enter your password to view the contents.</p>
        <button
          onClick={() => setLockModal("verify")}
          className="mt-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
        >
          Enter Password
        </button>
        {lockModal === "verify" && (
          <LockModal
            mode="verify"
            onConfirm={handleLockVerify}
            onCancel={() => setLockModal(null)}
            onUnlock={handleUnlockFully}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-screen overflow-hidden relative">
      {/* Top Header */}
      <header className="h-14 border-b border-panel-border flex items-center justify-between px-4 shrink-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <IconButton onClick={toggleSidebar} className="mr-2">
              <PanelLeft className="w-4 h-4" />
            </IconButton>
          )}
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", saveStatus === "saved" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
            {saveStatus === "saved" ? "Saved" : "Saving..."}
            {note && <span className="ml-2 border-l border-panel-border pl-2">Updated {formatDate(note.updatedAt)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton onClick={() => handleAction("pin")} active={note?.pinned} title="Pin Note">
            <Pin className={cn("w-4 h-4", note?.pinned && "fill-current")} />
          </IconButton>
          <IconButton onClick={() => handleAction("fav")} active={note?.favorite} title="Favorite">
            <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
          </IconButton>
          <IconButton
            onClick={() => note?.locked ? setLockModal("verify") : setLockModal("set")}
            active={note?.locked}
            title={note?.locked ? "Note is locked" : "Lock note"}
            className={note?.locked ? "text-amber-500" : ""}
          >
            {note?.locked ? <Lock className="w-4 h-4 fill-current" /> : <Lock className="w-4 h-4" />}
          </IconButton>
          <div className="w-px h-4 bg-panel-border mx-1" />
          <IconButton onClick={handleDelete} className="hover:text-destructive hover:bg-destructive/10" title="Delete">
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-2 border-b border-panel-border overflow-x-auto bg-panel/30 shrink-0 hide-scrollbar flex-wrap">
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
      </div>

      {/* AI Bubble Menu – custom floating menu on text selection */}
      <AiSelectionMenu
        editor={editor}
        visible={!aiLoading && !aiPreview}
        onAction={callAI}
      />

      {/* AI Preview Overlay */}
      {(aiLoading || aiPreview) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-popover border border-indigo-500/30 rounded-2xl shadow-2xl p-4 max-w-lg w-full mx-4">
          {aiLoading ? (
            <div className="flex items-center gap-3 text-indigo-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI is processing your text...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                AI Suggestion
              </div>
              <p className="text-sm text-foreground/90 bg-background rounded-lg p-3 border border-panel-border whitespace-pre-wrap">
                {aiPreview}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={applyAiPreview}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Replace selection
                </button>
                <button
                  onClick={dismissAiPreview}
                  className="px-4 py-2 rounded-lg border border-panel-border text-sm text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note Title"
            className="w-full text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
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

      {/* Lock Modal */}
      {lockModal === "set" && (
        <LockModal mode="set" onConfirm={handleLockSet} onCancel={() => setLockModal(null)} />
      )}
      {lockModal === "verify" && note?.locked && (
        <LockModal mode="verify" onConfirm={handleLockVerify} onCancel={() => setLockModal(null)} onUnlock={handleUnlockFully} />
      )}
    </div>
  );
}

function ToolbarButton({ command, active, icon, title }: { command: () => void; active: boolean; icon: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={command}
      title={title}
      className={cn(
        "p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors",
        active && "bg-panel text-primary"
      )}
    >
      {icon}
    </button>
  );
}
