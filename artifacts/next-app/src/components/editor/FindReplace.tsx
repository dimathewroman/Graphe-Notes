import { useEffect, useRef, useState, useCallback } from "react";
import { Extension } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { X, ChevronUp, ChevronDown, CaseSensitive } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Match finding ─────────────────────────────────────────────────────────────

function findMatches(
  doc: ProseMirrorNode,
  searchTerm: string,
  caseSensitive: boolean
): { from: number; to: number }[] {
  const results: { from: number; to: number }[] = [];
  if (!searchTerm) return results;

  const needle = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const haystack = caseSensitive ? node.text : node.text.toLowerCase();
    let offset = 0;
    while (true) {
      const idx = haystack.indexOf(needle, offset);
      if (idx === -1) break;
      results.push({ from: pos + idx, to: pos + idx + needle.length });
      offset = idx + 1;
    }
  });

  return results;
}

// ── Plugin state ──────────────────────────────────────────────────────────────

export const findReplacePluginKey = new PluginKey<FindReplaceState>("findReplace");

interface FindReplaceState {
  searchTerm: string;
  caseSensitive: boolean;
  currentIndex: number;
  results: { from: number; to: number }[];
  decorations: DecorationSet;
}

type FindReplaceMeta =
  | { type: "setSearch"; searchTerm: string; caseSensitive: boolean }
  | { type: "setIndex"; index: number }
  | { type: "clear" };

function buildDecorations(
  doc: ProseMirrorNode,
  results: { from: number; to: number }[],
  currentIndex: number
): DecorationSet {
  if (!results.length) return DecorationSet.empty;
  const decos = results.map((m, i) =>
    Decoration.inline(m.from, m.to, {
      class: i === currentIndex ? "find-highlight-active" : "find-highlight",
    })
  );
  return DecorationSet.create(doc, decos);
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const findReplacePlugin = new Plugin<FindReplaceState>({
  key: findReplacePluginKey,
  state: {
    init(): FindReplaceState {
      return {
        searchTerm: "",
        caseSensitive: false,
        currentIndex: -1,
        results: [],
        decorations: DecorationSet.empty,
      };
    },
    apply(tr: Transaction, prev: FindReplaceState, _oldState: EditorState, newState: EditorState): FindReplaceState {
      const doc = newState.doc;
      const meta = tr.getMeta(findReplacePluginKey) as FindReplaceMeta | undefined;

      if (meta?.type === "clear") {
        return { searchTerm: "", caseSensitive: false, currentIndex: -1, results: [], decorations: DecorationSet.empty };
      }

      if (meta?.type === "setIndex") {
        return { ...prev, currentIndex: meta.index, decorations: buildDecorations(doc, prev.results, meta.index) };
      }

      let { searchTerm, caseSensitive, currentIndex } = prev;
      let needsRecompute = tr.docChanged;

      if (meta?.type === "setSearch") {
        searchTerm = meta.searchTerm;
        caseSensitive = meta.caseSensitive;
        currentIndex = 0;
        needsRecompute = true;
      }

      if (!searchTerm) {
        return { searchTerm: "", caseSensitive, currentIndex: -1, results: [], decorations: DecorationSet.empty };
      }

      if (needsRecompute) {
        const results = findMatches(doc, searchTerm, caseSensitive);
        const ci = results.length > 0 ? Math.max(0, Math.min(currentIndex, results.length - 1)) : -1;
        return { searchTerm, caseSensitive, currentIndex: ci, results, decorations: buildDecorations(doc, results, ci) };
      }

      return { ...prev, decorations: prev.decorations.map(tr.mapping, doc) };
    },
  },
  props: {
    decorations(state: EditorState) {
      return findReplacePluginKey.getState(state)?.decorations ?? DecorationSet.empty;
    },
  },
});

// ── Scroll helper ─────────────────────────────────────────────────────────────

function scrollToMatch(editor: Editor, match: { from: number; to: number } | undefined) {
  if (!match) return;
  try {
    const { node } = editor.view.domAtPos(match.from);
    const el = node instanceof Text ? node.parentElement : (node as Element);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch {}
}

// ── TipTap Extension ──────────────────────────────────────────────────────────

export const FindReplaceExtension = Extension.create({
  name: "findReplace",

  addProseMirrorPlugins() {
    return [findReplacePlugin];
  },
});

// ── Editor command helpers (called directly with editor reference) ─────────────

export function frSetSearch(editor: Editor, searchTerm: string, caseSensitive: boolean) {
  const { tr } = editor.state;
  tr.setMeta(findReplacePluginKey, { type: "setSearch", searchTerm, caseSensitive } as FindReplaceMeta);
  editor.view.dispatch(tr);
}

export function frNext(editor: Editor) {
  const ps = findReplacePluginKey.getState(editor.state);
  if (!ps || ps.results.length === 0) return;
  const next = (ps.currentIndex + 1) % ps.results.length;
  const { tr } = editor.state;
  tr.setMeta(findReplacePluginKey, { type: "setIndex", index: next } as FindReplaceMeta);
  editor.view.dispatch(tr);
  scrollToMatch(editor, ps.results[next]);
}

export function frPrev(editor: Editor) {
  const ps = findReplacePluginKey.getState(editor.state);
  if (!ps || ps.results.length === 0) return;
  const prev = (ps.currentIndex - 1 + ps.results.length) % ps.results.length;
  const { tr } = editor.state;
  tr.setMeta(findReplacePluginKey, { type: "setIndex", index: prev } as FindReplaceMeta);
  editor.view.dispatch(tr);
  scrollToMatch(editor, ps.results[prev]);
}

export function frReplaceNext(editor: Editor, replacement: string) {
  const ps = findReplacePluginKey.getState(editor.state);
  if (!ps || ps.results.length === 0) return;
  const idx = ps.currentIndex >= 0 ? ps.currentIndex : 0;
  const match = ps.results[idx];
  if (!match) return;
  const { tr } = editor.state;
  tr.insertText(replacement, match.from, match.to);
  editor.view.dispatch(tr);
}

export function frReplaceAll(editor: Editor, replacement: string) {
  const ps = findReplacePluginKey.getState(editor.state);
  if (!ps || ps.results.length === 0) return;
  const { tr } = editor.state;
  // Process end-to-start to preserve positions
  const sorted = [...ps.results].sort((a, b) => b.from - a.from);
  for (const match of sorted) {
    tr.insertText(replacement, match.from, match.to);
  }
  editor.view.dispatch(tr);
}

export function frClear(editor: Editor) {
  const { tr } = editor.state;
  tr.setMeta(findReplacePluginKey, { type: "clear" } as FindReplaceMeta);
  editor.view.dispatch(tr);
}

// ── Panel Component ───────────────────────────────────────────────────────────

interface FindReplacePanelProps {
  editor: Editor;
  onClose: () => void;
}

export function FindReplacePanel({ editor, onClose }: FindReplacePanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 30);
  }, []);

  // Sync match count/index from plugin state after each transaction
  useEffect(() => {
    const syncState = () => {
      const ps = findReplacePluginKey.getState(editor.state);
      if (ps) {
        setMatchCount(ps.results.length);
        setCurrentMatch(ps.results.length > 0 ? ps.currentIndex + 1 : 0);
      }
    };
    editor.on("transaction", syncState);
    return () => { editor.off("transaction", syncState); };
  }, [editor]);

  // Push search term / case sensitivity into the plugin
  useEffect(() => {
    frSetSearch(editor, searchTerm, caseSensitive);
  }, [searchTerm, caseSensitive, editor]);

  // Esc closes (capture phase, before editor handles it)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [onClose]);

  // Outside click closes
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleClose = useCallback(() => {
    frClear(editor);
    onClose();
  }, [editor, onClose]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) frPrev(editor);
      else frNext(editor);
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      frReplaceNext(editor, replaceTerm);
    }
  };

  const counterText = searchTerm
    ? matchCount === 0
      ? "No results"
      : `${currentMatch} of ${matchCount}`
    : "";

  return (
    <div
      ref={panelRef}
      className="absolute top-2 right-4 z-50 w-[340px] bg-popover border border-panel-border rounded-lg shadow-2xl overflow-hidden luminance-border-top"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Find row */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-panel-border">
        <div className="flex-1 flex items-center gap-1.5 bg-background rounded px-2 py-1 border border-panel-border focus-within:border-primary/50">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find"
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground min-w-0"
          />
          {counterText && (
            <span className="text-xs text-muted-foreground shrink-0 select-none">{counterText}</span>
          )}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setCaseSensitive((v) => !v)}
            title="Case sensitive"
            className={cn(
              "shrink-0 p-0.5 rounded transition-colors",
              caseSensitive
                ? "text-primary bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-panel"
            )}
          >
            <CaseSensitive className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => frPrev(editor)}
          disabled={matchCount === 0}
          title="Previous match (Shift+Enter)"
          className="p-1 rounded hover:bg-panel text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => frNext(editor)}
          disabled={matchCount === 0}
          title="Next match (Enter)"
          className="p-1 rounded hover:bg-panel text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClose}
          title="Close (Esc)"
          className="p-1 rounded hover:bg-panel text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Replace row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <div className="flex-1 flex items-center bg-background rounded px-2 py-1 border border-panel-border focus-within:border-primary/50">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace"
            className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground min-w-0"
          />
        </div>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => frReplaceNext(editor, replaceTerm)}
          disabled={matchCount === 0}
          title="Replace current match"
          className="px-2 py-1 rounded text-xs font-medium bg-panel hover:bg-panel-hover text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          Replace
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => frReplaceAll(editor, replaceTerm)}
          disabled={matchCount === 0}
          title="Replace all matches"
          className="px-2 py-1 rounded text-xs font-medium bg-panel hover:bg-panel-hover text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          All
        </button>
      </div>
    </div>
  );
}
