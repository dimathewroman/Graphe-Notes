// Native-style mobile selection menu with Copy/Paste/Delete/Select All + Writing Tools panel.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { Sparkles, ChevronRight, ArrowLeft, Copy, ClipboardPaste, Trash2, Type, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { actionGroups } from "./ai-action-groups";

export function MobileSelectionMenu({
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
      // Suppress on node selections (e.g. image clicks) — no text to act on
      if (editor.state.selection instanceof NodeSelection) { setRect(null); return; }

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
