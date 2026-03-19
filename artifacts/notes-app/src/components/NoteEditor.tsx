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
  useToggleNoteVault, useGetVaultStatus, useSetupVault, useUnlockVault,
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
  Undo2, Redo2, Clock, ArrowLeft, Menu, MoreHorizontal, MoreVertical, PanelLeftClose,
  Share, Search, Copy, ClipboardPaste, Type, Highlighter, Minus,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon
} from "lucide-react";
import SuperscriptExt from "@tiptap/extension-superscript";
import SubscriptExt from "@tiptap/extension-subscript";
import { ColorPickerDropdown } from "./editor/ColorPickerDropdown";
import { SlashCommandExtension, SlashCommandMenu } from "./editor/SlashCommandMenu";
import { WordCountPopover } from "./editor/WordCountPopover";
import { IconButton } from "./ui/IconButton";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { cn, formatDate } from "@/lib/utils";
import { VaultModal } from "./VaultModal";
import { useBreakpoint, useKeyboardHeight } from "@/hooks/use-mobile";
import { authenticatedFetch } from "@workspace/api-client-react/custom-fetch";
import { useDemoMode } from "@/App";

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
      top = rect.top - 56;
      if (left + menuW > vw - pad) left = vw - menuW - pad;
      if (left < pad) left = pad;
      if (top < pad) top = rect.bottom + 8;
    }

    return { top, left, width: isMobile ? `calc(100vw - ${pad * 2}px)` : undefined };
  }, [rect, isMobile]);

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

function MobileSelectionMenu({
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
  const [showWritingTools, setShowWritingTools] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [customInputFor, setCustomInputFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      setShowWritingTools(false);
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
      const text = editor.state.doc.textBetween(from, to);
      onSelectionCapture(from, to, text);
    };

    const handleBlur = () => setTimeout(() => {
      setRect(null);
      setShowWritingTools(false);
    }, 150);

    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    editor.on("blur", handleBlur);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
      editor.off("blur", handleBlur);
    };
  }, [editor, visible, onSelectionCapture]);

  const [menuTop, setMenuTop] = useState<number>(0);

  const clampMenu = useCallback(() => {
    if (!rect || !menuRef.current) return;
    const pad = 8;
    const menuH = menuRef.current.getBoundingClientRect().height || 48;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    let top = rect.top - menuH - 8;
    if (top < pad) top = rect.bottom + 8;
    if (top + menuH > vh - pad) top = Math.max(pad, vh - menuH - pad);
    setMenuTop(top);
  }, [rect]);

  useEffect(() => {
    clampMenu();
  }, [clampMenu, showWritingTools, expandedGroup, expandedAction]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => clampMenu();
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, [clampMenu]);

  const menuStyle = useMemo(() => {
    if (!rect) return { display: "none" as const };
    const pad = 8;
    return { top: menuTop, left: pad, right: pad };
  }, [rect, menuTop]);

  if (!rect || !visible) return null;

  const resetMenu = () => {
    setShowWritingTools(false);
    setExpandedGroup(null);
    setExpandedAction(null);
    setCustomInputFor(null);
    setCustomText("");
  };

  const handleCopy = async () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to);
    try { await navigator.clipboard.writeText(text); } catch {}
    resetMenu();
  };

  const handlePaste = async () => {
    if (!editor) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {}
    resetMenu();
  };

  const handleDelete = () => {
    if (!editor) return;
    editor.chain().focus().deleteSelection().run();
    resetMenu();
  };

  const handleSelectAll = () => {
    if (!editor) return;
    editor.chain().focus().selectAll().run();
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

  if (showWritingTools) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 pointer-events-auto"
        style={menuStyle}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-panel-border mb-1">
            <button
              onClick={() => { setShowWritingTools(false); setExpandedGroup(null); setExpandedAction(null); }}
              className="p-1 rounded hover:bg-panel transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Writing Tools
            </span>
          </div>
          {actionGroups.map((group) => (
            <div key={group.label}>
              <button
                onClick={() => {
                  setExpandedGroup(expandedGroup === group.label ? null : group.label);
                  setExpandedAction(null);
                  setCustomInputFor(null);
                  setCustomText("");
                }}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                  expandedGroup === group.label
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-foreground hover:bg-panel"
                )}
              >
                <span className="flex items-center gap-2">
                  {group.icon}
                  {group.label}
                </span>
                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expandedGroup === group.label && "rotate-90")} />
              </button>
              {expandedGroup === group.label && (
                <div className="ml-4 border-l border-panel-border pl-2 my-1">
                  {group.actions.map((action) => (
                    <div key={action.id}>
                      {action.presets ? (
                        <>
                          <button
                            onClick={() => {
                              setExpandedAction(expandedAction === action.id ? null : action.id);
                              setCustomInputFor(null);
                              setCustomText("");
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-2 py-2 rounded-lg text-xs transition-colors",
                              expandedAction === action.id
                                ? "bg-indigo-500/10 text-indigo-400"
                                : "text-muted-foreground hover:bg-panel hover:text-foreground"
                            )}
                          >
                            <span className="flex items-center gap-1.5">
                              {action.icon}
                              {action.label}
                            </span>
                            <ChevronRight className={cn("w-3 h-3 transition-transform", expandedAction === action.id && "rotate-90")} />
                          </button>
                          {expandedAction === action.id && (
                            <div className="ml-3 border-l border-panel-border pl-2 my-0.5">
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
                                      className="flex items-center gap-1.5 w-full px-2 py-2 rounded-lg text-xs text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
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
                          className="flex items-center gap-1.5 w-full px-2 py-2 rounded-lg text-xs text-muted-foreground hover:bg-panel hover:text-foreground transition-colors"
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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 pointer-events-auto"
      style={menuStyle}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 flex items-center gap-0.5 p-1">
        <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-foreground hover:bg-panel transition-colors min-h-[36px]">
          <Copy className="w-3.5 h-3.5" />
          Copy
        </button>
        <button onClick={handlePaste} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-foreground hover:bg-panel transition-colors min-h-[36px]">
          <ClipboardPaste className="w-3.5 h-3.5" />
          Paste
        </button>
        <button onClick={handleDelete} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-foreground hover:bg-panel transition-colors min-h-[36px]">
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
        <button onClick={handleSelectAll} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-foreground hover:bg-panel transition-colors min-h-[36px] whitespace-nowrap">
          <Type className="w-3.5 h-3.5" />
          Select All
        </button>
        <div className="w-px h-5 bg-panel-border mx-0.5 shrink-0" />
        <button
          onClick={() => setShowWritingTools(true)}
          className="flex items-center justify-center p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors min-h-[36px] min-w-[36px]"
          title="Writing Tools"
        >
          <Sparkles className="w-4 h-4" />
        </button>
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

function ScrollableToolbar({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
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
    <div className={cn("relative border-b border-panel-border shrink-0", className)} style={style}>
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
  const keyboardHeight = useKeyboardHeight();
  const queryClient = useQueryClient();
  const isDemo = useDemoMode();
  const isDemoRef = useRef(isDemo);
  isDemoRef.current = isDemo;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: note, isLoading } = useGetNote(selectedNoteId || 0, {
    query: {
      enabled: !!selectedNoteId,
      // In demo mode keep the cache alive but never refetch — the cache is pre-populated by
      // enterDemoMode() and subsequent writes go directly to the cache via setQueryData.
      staleTime: isDemo ? Infinity : 0,
      gcTime: isDemo ? Infinity : 5 * 60 * 1000,
    } as any,
  });

  const updateNoteMut = useUpdateNote();
  const deleteNoteMut = useDeleteNote();
  const pinMut = useToggleNotePin();
  const favMut = useToggleNoteFavorite();
  const vaultMut = useToggleNoteVault();
  const setupVaultMut = useSetupVault();
  const unlockVaultMut = useUnlockVault();
  const { data: vaultStatus } = useGetVaultStatus();
  const { isVaultUnlocked, setVaultUnlocked } = useAppStore();
  const [showVaultSetupModal, setShowVaultSetupModal] = useState(false);
  const [showVaultUnlockModal, setShowVaultUnlockModal] = useState(false);
  const [demoVaultConfigured, setDemoVaultConfigured] = useState(false);

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
      SlashCommandExtension,
      SuperscriptExt,
      SubscriptExt,
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
          if (isDemoRef.current) {
            // Demo mode: update the React Query cache directly (ephemeral, resets on refresh)
            const existing = queryClient.getQueryData(getGetNoteQueryKey(id)) as any;
            if (existing) {
              queryClient.setQueryData(getGetNoteQueryKey(id), {
                ...existing,
                ...data,
                updatedAt: new Date().toISOString(),
              });
            }
          } else {
            await updateNoteMut.mutateAsync({ id, data });
            queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
            // Fire-and-forget version snapshot (server enforces 5-min interval)
            authenticatedFetch(`/api/notes/${id}/versions`, { method: "POST" }).catch(() => {});
          }
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

  const handleRestoreVersion = useCallback((content: string, restoredTitle: string) => {
    if (!editor || !selectedNoteId) return;
    editor.commands.setContent(content, { emitUpdate: false });
    setTitle(restoredTitle);
    debouncedSave(selectedNoteId, { content, title: restoredTitle, contentText: editor.getText() });
  }, [editor, selectedNoteId, debouncedSave]);

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (isDemo) {
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...existing, _demoDeleted: true });
      selectNote(null);
      if (bp !== "desktop") setMobileView("list");
      return;
    }
    if (confirm("Are you sure you want to delete this note?")) {
      await deleteNoteMut.mutateAsync({ id: selectedNoteId });
      queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
      selectNote(null);
      if (bp !== "desktop") setMobileView("list");
    }
  };

  const handleAction = async (action: "pin" | "fav") => {
    if (!selectedNoteId) return;
    if (isDemo) {
      // Update cache directly for ephemeral pin/fav in demo mode
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) {
        queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), {
          ...existing,
          ...(action === "pin" ? { pinned: !existing.pinned } : { favorite: !existing.favorite }),
        });
      }
      return;
    }
    if (action === "pin") await pinMut.mutateAsync({ id: selectedNoteId });
    if (action === "fav") await favMut.mutateAsync({ id: selectedNoteId });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleToggleVault = async () => {
    if (!selectedNoteId || !note) return;
    // If moving TO vault and no PIN is set, prompt setup first (both demo and real)
    if (!note.vaulted) {
      const pinConfigured = isDemo ? demoVaultConfigured : vaultStatus?.isConfigured;
      if (!pinConfigured) {
        setShowVaultSetupModal(true);
        return;
      }
    }
    if (isDemo) {
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...existing, vaulted: !note.vaulted });
      return;
    }
    await vaultMut.mutateAsync({ id: selectedNoteId, data: { vaulted: !note.vaulted } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleVaultSetupConfirm = async (hash: string) => {
    if (!selectedNoteId || !note) return;
    setShowVaultSetupModal(false);
    if (isDemo) {
      setDemoVaultConfigured(true);
      const existing = queryClient.getQueryData(getGetNoteQueryKey(selectedNoteId)) as any;
      if (existing) queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...existing, vaulted: true });
      return;
    }
    await setupVaultMut.mutateAsync({ data: { passwordHash: hash } });
    await vaultMut.mutateAsync({ id: selectedNoteId, data: { vaulted: true } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
  };

  const handleUnlockConfirm = async (hash: string) => {
    setShowVaultUnlockModal(false);
    if (isDemo) {
      setVaultUnlocked(true);
      return;
    }
    await unlockVaultMut.mutateAsync({ data: { passwordHash: hash } });
    setVaultUnlocked(true);
  };

  // Tags
  const addTag = async () => {
    if (!selectedNoteId || !note) return;
    const tag = tagInput.trim().replace(/^#/, "");
    if (!tag || note.tags?.includes(tag)) { setTagInput(""); setShowTagInput(false); return; }
    const newTags = [...(note.tags ?? []), tag];
    if (isDemo) {
      queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...note, tags: newTags });
      setTagInput(""); setShowTagInput(false); return;
    }
    await updateNoteMut.mutateAsync({ id: selectedNoteId, data: { tags: newTags } });
    queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(selectedNoteId) });
    queryClient.invalidateQueries({ queryKey: getGetNotesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTagsQueryKey() });
    setTagInput("");
    setShowTagInput(false);
  };

  const removeTag = async (tag: string) => {
    if (!selectedNoteId || !note) return;
    const newTags = (note.tags ?? []).filter(t => t !== tag);
    if (isDemo) {
      queryClient.setQueryData(getGetNoteQueryKey(selectedNoteId), { ...note, tags: newTags });
      return;
    }
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
        const r = await authenticatedFetch(`/api/models?${params}`);
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
      const res = await authenticatedFetch("/api/ai/complete", {
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
      <div className="flex-1 flex flex-col bg-background relative">
        {bp === "desktop" && (!isSidebarOpen || !isNoteListOpen) && (
          <div className="h-14 border-b border-panel-border flex items-center px-2 gap-1 bg-background/80 backdrop-blur-md shrink-0">
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
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="w-16 h-16 mb-4 opacity-20" />
          <h2 className="text-xl font-medium mb-2 text-foreground/80">Select a note</h2>
          <p className="text-sm">Choose a note from the list or create a new one to start writing.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !editor) {
    return <div className="flex-1 flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (note?.vaulted && !isVaultUnlocked) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        <div className="h-14 border-b border-panel-border flex items-center px-2 gap-1 bg-background/80 backdrop-blur-md shrink-0">
          {bp === "mobile" && (
            <button onClick={handleBack} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-panel transition-colors">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          {bp === "desktop" && !isSidebarOpen && (
            <IconButton onClick={toggleSidebar} title="Show sidebar">
              <PanelLeft className="w-4 h-4" />
            </IconButton>
          )}
          {bp === "desktop" && !isNoteListOpen && (
            <IconButton onClick={toggleNoteList} title="Show note list">
              <PanelLeftClose className="w-4 h-4 scale-x-[-1]" />
            </IconButton>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-xl font-medium text-foreground/80">This note is in the vault</h2>
          <p className="text-sm text-center max-w-xs">Unlock the vault to view this note.</p>
          <button
            onClick={() => setShowVaultUnlockModal(true)}
            className="mt-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
          >
            Unlock Vault
          </button>
        </div>
        {showVaultUnlockModal && (
          <VaultModal
            mode="unlock"
            onConfirm={handleUnlockConfirm}
            onCancel={() => setShowVaultUnlockModal(false)}
          />
        )}
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
          {bp === "mobile" && editor && (
            <>
              <IconButton
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo"
                className={!editor.can().undo() ? "opacity-30 pointer-events-none" : ""}
              >
                <Undo2 className="w-4 h-4" />
              </IconButton>
              <IconButton
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo"
                className={!editor.can().redo() ? "opacity-30 pointer-events-none" : ""}
              >
                <Redo2 className="w-4 h-4" />
              </IconButton>
            </>
          )}
          {bp !== "mobile" && (
            <>
              <IconButton onClick={() => handleAction("pin")} active={note?.pinned} title="Pin Note">
                <Pin className={cn("w-4 h-4", note?.pinned && "fill-current")} />
              </IconButton>
              <IconButton onClick={() => handleAction("fav")} active={note?.favorite} title="Favorite">
                <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
              </IconButton>
            </>
          )}
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
              onPin={() => handleAction("pin")}
              onFav={() => handleAction("fav")}
              onVaultToggle={handleToggleVault}
              onVersionHistory={() => setShowVersionHistory(v => !v)}
              onDelete={handleDelete}
              showVersionHistory={showVersionHistory}
              isMobile={bp === "mobile"}
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

      {/* Toolbar — desktop/tablet: below header; mobile: at bottom */}
      {bp !== "mobile" && (
        <EditorToolbar editor={editor} linkPopover={linkPopover} setLinkPopover={setLinkPopover} linkInputRef={linkInputRef} linkPopoverRef={linkPopoverRef} openLinkPopover={openLinkPopover} applyLink={applyLink} showUndoRedo />
      )}

      {/* Text selection menus — mobile: native-style popup with Writing Tools; desktop/tablet: AI toolbar */}
      {bp === "mobile" ? (
        <MobileSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={(from, to, text) => {
            savedAiSelection.current = { from, to, text };
          }}
        />
      ) : (
        <AiSelectionMenu
          editor={editor}
          visible={!aiLoading}
          onAction={callAI}
          onSelectionCapture={(from, to, text) => {
            savedAiSelection.current = { from, to, text };
          }}
        />
      )}

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
        <div className={cn("max-w-3xl mx-auto px-4 py-6 md:px-8 md:py-12", bp === "mobile" && "pb-20")}>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Note Title"
            className="w-full text-2xl md:text-4xl font-bold bg-transparent border-none outline-none mb-4 text-foreground placeholder:text-muted-foreground/30 resize-none tracking-tight"
          />

          {/* Tags Row */}
          <div className="flex items-center flex-wrap gap-1.5 mb-8">
            {note?.tags?.map(tag => (
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

      {/* Slash command floating menu */}
      <SlashCommandMenu editor={editor} />

      {/* Version History Panel */}
      {showVersionHistory && selectedNoteId && (
        <VersionHistoryPanel
          noteId={selectedNoteId}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* Mobile bottom toolbar — keyboard-aware */}
      {bp === "mobile" && (
        <EditorToolbar
          editor={editor}
          linkPopover={linkPopover}
          setLinkPopover={setLinkPopover}
          linkInputRef={linkInputRef}
          linkPopoverRef={linkPopoverRef}
          openLinkPopover={openLinkPopover}
          applyLink={applyLink}
          className="fixed left-0 right-0 z-40 border-t border-panel-border bg-background/95 backdrop-blur-md"
          style={{ bottom: keyboardHeight > 0 ? keyboardHeight : 0 }}
        />
      )}

      {showVaultSetupModal && (
        <VaultModal
          mode="setup"
          onConfirm={handleVaultSetupConfirm}
          onCancel={() => setShowVaultSetupModal(false)}
        />
      )}

    </div>
  );
}

function EditorToolbar({ editor, linkPopover, setLinkPopover, linkInputRef, linkPopoverRef, openLinkPopover, applyLink, showUndoRedo, className, style }: {
  editor: ReturnType<typeof useEditor>;
  linkPopover: { visible: boolean; url: string };
  setLinkPopover: React.Dispatch<React.SetStateAction<{ visible: boolean; url: string }>>;
  linkInputRef: React.RefObject<HTMLInputElement | null>;
  linkPopoverRef: React.RefObject<HTMLDivElement | null>;
  openLinkPopover: () => void;
  applyLink: () => void;
  showUndoRedo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [colorPicker, setColorPicker] = useState<"text" | "highlight" | null>(null);
  if (!editor) return null;

  const activeTextColor: string | undefined = editor.getAttributes("textStyle").color;
  const activeHighlightColor: string | undefined = editor.getAttributes("highlight").color;

  return (
    <ScrollableToolbar className={className} style={style}>
      {showUndoRedo && (
        <>
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
        </>
      )}

      <ToolbarButton command={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} icon={<Bold className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} icon={<Italic className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} icon={<UnderlineIcon className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} icon={<Strikethrough className="w-4 h-4" />} />
      <ToolbarButton command={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} icon={<SuperscriptIcon className="w-4 h-4" />} title="Superscript" />
      <ToolbarButton command={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} icon={<SubscriptIcon className="w-4 h-4" />} title="Subscript" />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      {/* Text color picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => setColorPicker(colorPicker === "text" ? null : "text")}
          title="Text color"
          className={cn(
            "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 px-2 md:px-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex flex-col items-center justify-center gap-0.5 py-1",
            colorPicker === "text" && "bg-panel text-primary"
          )}
        >
          <span className="text-sm font-bold leading-none">A</span>
          <div
            className="w-4 h-[3px] rounded-sm"
            style={{ backgroundColor: activeTextColor ?? "currentColor" }}
          />
        </button>
        {colorPicker === "text" && (
          <ColorPickerDropdown type="text" editor={editor} onClose={() => setColorPicker(null)} />
        )}
      </div>

      {/* Highlight color picker */}
      <div className="relative shrink-0">
        <button
          onClick={() => setColorPicker(colorPicker === "highlight" ? null : "highlight")}
          title="Highlight color"
          className={cn(
            "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex items-center justify-center",
            colorPicker === "highlight" && "bg-panel text-primary",
            activeHighlightColor && "text-foreground"
          )}
          style={activeHighlightColor ? { color: activeHighlightColor } : undefined}
        >
          <Highlighter className="w-4 h-4" />
        </button>
        {colorPicker === "highlight" && (
          <ColorPickerDropdown type="highlight" editor={editor} onClose={() => setColorPicker(null)} />
        )}
      </div>

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
      <ToolbarButton command={() => editor.chain().focus().setHorizontalRule().run()} active={false} icon={<Minus className="w-4 h-4" />} title="Horizontal divider" />

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

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

      <div className="w-px h-5 bg-panel-border mx-1.5 shrink-0" />

      <WordCountPopover editor={editor} />
    </ScrollableToolbar>
  );
}

function OverflowMenu({ note, onPin, onFav, onVaultToggle, onVersionHistory, onDelete, showVersionHistory, isMobile }: {
  note: { vaulted: boolean; pinned: boolean; favorite: boolean } | null | undefined;
  onPin?: () => void;
  onFav?: () => void;
  onVaultToggle: () => void;
  onVersionHistory: () => void;
  onDelete: () => void;
  showVersionHistory: boolean;
  isMobile?: boolean;
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
        <MoreVertical className="w-4 h-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] bg-popover border border-panel-border rounded-xl shadow-2xl py-1">
          {isMobile && onPin && (
            <button onClick={() => { onPin(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
              <Pin className={cn("w-4 h-4", note?.pinned && "fill-current text-primary")} />
              {note?.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {isMobile && onFav && (
            <button onClick={() => { onFav(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
              <Star className={cn("w-4 h-4", note?.favorite && "fill-current text-yellow-500")} />
              {note?.favorite ? "Unfavorite" : "Favorite"}
            </button>
          )}
          <button onClick={() => { setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:bg-panel transition-colors cursor-default">
            <Share className="w-4 h-4" />
            Share
          </button>
          {(isMobile && (onPin || onFav)) && <div className="h-px bg-panel-border mx-2 my-1" />}
          <button onClick={() => { onVaultToggle(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-panel transition-colors">
            <ShieldCheck className={cn("w-4 h-4", note?.vaulted && "fill-current text-indigo-400")} />
            {note?.vaulted ? "Remove from Vault" : "Move to Vault"}
          </button>
          <button onClick={() => { onVersionHistory(); setOpen(false); }} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-panel transition-colors", showVersionHistory ? "text-primary" : "text-foreground")}>
            <Clock className="w-4 h-4" />
            Version History
          </button>
          <button onClick={() => { setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:bg-panel transition-colors cursor-default">
            <Search className="w-4 h-4" />
            Find in Page
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
