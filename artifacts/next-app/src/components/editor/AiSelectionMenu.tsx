// Desktop floating AI action menu that appears above a text selection.

import { useEffect, useMemo, useRef, useState } from "react";
import type { useEditor } from "@tiptap/react";
import { Sparkles, ChevronRight, Check, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { actionGroups } from "./ai-action-groups";

export function AiSelectionMenu({
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
  const [interactive, setInteractive] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const interactiveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleClose = () => {
    if (customInputFor) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setExpandedGroup(null);
      setExpandedAction(null);
    }, 400);
  };

  const cancelClose = () => clearTimeout(closeTimer.current);

  useEffect(() => {
    if (!visible) {
      setExpandedGroup(null);
      setExpandedAction(null);
      setCustomInputFor(null);
      setCustomText("");
    }
  }, [visible]);

  // 200ms delay before enabling pointer-events prevents a rapid double-click
  // that opens the menu from immediately firing on a button.
  useEffect(() => {
    clearTimeout(interactiveTimer.current);
    if (rect) {
      setInteractive(false);
      interactiveTimer.current = setTimeout(() => setInteractive(true), 200);
    } else {
      setInteractive(false);
    }
    return () => clearTimeout(interactiveTimer.current);
  }, [rect]);

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
      // Capture the selection NOW — before any menu interaction disturbs it.
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

  const { menuStyle, dropdownDir } = useMemo(() => {
    if (!rect) return { menuStyle: {}, dropdownDir: "down" as "up" | "down" };
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuH = 44;
    const estimatedDropdownH = 130;
    // Max width — toolbar shrinks to fit content via transform centering
    const maxMenuW = Math.min(isMobile ? vw - pad * 2 : 560, vw - pad * 2);
    let left: number;
    let top: number;

    if (isMobile) {
      left = pad;
      top = rect.bottom + 10;
      if (top + menuH > vh - pad) {
        top = Math.max(pad, rect.top - menuH - 10);
      }
    } else {
      // Center over selection using transform; clamp so toolbar stays in viewport
      const selCenterX = rect.left + rect.width / 2;
      const halfMaxW = maxMenuW / 2 + pad;
      left = Math.max(halfMaxW, Math.min(vw - halfMaxW, selCenterX));
      top = rect.top - menuH - 12;
      if (top < pad) {
        top = rect.bottom + 12;
        if (top + menuH > vh - pad) top = vh - menuH - pad;
      }
    }

    // Open dropdowns upward when there's room above the toolbar
    const dir: "up" | "down" = top >= estimatedDropdownH + pad ? "up" : "down";

    return {
      menuStyle: isMobile
        ? { top, left, width: `calc(100vw - ${pad * 2}px)` }
        : { top, left, maxWidth: maxMenuW, transform: "translateX(-50%)" },
      dropdownDir: dir,
    };
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
      className={cn("fixed z-50", interactive ? "pointer-events-auto" : "pointer-events-none")}
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
                  cancelClose();
                  setExpandedGroup(group.label);
                  setExpandedAction(null);
                  setCustomInputFor(null);
                  setCustomText("");
                }
              }}
              onMouseLeave={() => {
                if (!isMobile) scheduleClose();
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
                  isMobile
                    ? "fixed left-2 right-2"
                    : dropdownDir === "up"
                      ? "absolute bottom-full left-0 mb-1"
                      : "absolute top-full left-0 mt-1"
                )}
                style={isMobile ? (dropdownDir === "up"
                  ? { bottom: (window.innerHeight - (menuRef.current?.getBoundingClientRect().top ?? 0) + 4) }
                  : { top: (menuRef.current?.getBoundingClientRect().bottom ?? 0) + 4 }
                ) : undefined}
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
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
                          <div
                            className={cn(
                              "bg-popover border border-panel-border rounded-xl shadow-xl shadow-black/30 p-1 min-w-[180px] z-50",
                              isMobile
                                ? "pl-4 border-l border-t-0 border-r-0 border-b-0 rounded-none shadow-none"
                                : dropdownDir === "up"
                                  ? "absolute left-full bottom-0 ml-1"
                                  : "absolute left-full top-0 ml-1"
                            )}
                            onMouseEnter={cancelClose}
                            onMouseLeave={scheduleClose}
                          >
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
        <div className={cn("bg-panel-border", isMobile ? "w-full h-px my-0.5" : "w-px h-4")} />
        <button
          onClick={() => { onAction("continue_writing"); resetMenu(); }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors min-h-[36px] text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400"
        >
          <PenLine className="w-3 h-3" />
          {!isMobile && "Continue"}
        </button>
      </div>
    </div>
  );
}
