# TipTap Pro + Novel.sh — Capability Audit Report

**Session:** Phase 0, Session 2 — Finalize TipTap foundation before Yjs migration  
**Date:** 2026-05-09  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Sources studied:**
- TipTap Pro `@tiptap-pro/extension-drag-handle` v2.21.5 — compiled source from registry.tiptap.dev  
- `github.com/ueberdosis/tiptap-ui-components` (shallow clone) — Simple template + UI primitives only; no Notion-like template in public repo  
- `github.com/steven-tey/novel` — MIT, headless package + `apps/web` demo  
- Session 1 report: `SESSION_1_REPORT.md` (cross-reference copy of `study/tiptap-simple-template-audit/AUDIT_REPORT.md`)  
**Branch:** `chore/tiptap-pro-novel-audit`  
**License note:** TipTap Pro extensions are installed via 30-day trial for study only. No Pro extension code will enter `artifacts/next-app`. All implementation sources are Novel.sh (MIT) or original work.

---

## Executive Summary

### Top 5 Must-Haves That Session 1 Missed or Under-Covered

**1. `tiptap-extension-global-drag-handle` (MIT) is the implementation path for desktop drag handles**  
Session 1 said "defer drag handles to Session 2 — evaluate TipTap Pro first." Session 2 delivers the answer: Novel.sh uses `tiptap-extension-global-drag-handle`, an MIT-licensed ProseMirror plugin, not TipTap Pro's proprietary `@tiptap-pro/extension-drag-handle`. The MIT package is a single pnpm install. The Pro drag handle has richer features (Tippy.js positioning, NodeRangeSelection, Yjs-awareness) but cannot be used in production due to the license boundary. The MIT package handles block dragging; a custom context menu can be built alongside it with shadcn `DropdownMenu`.

**2. Novel.sh's `UploadImagesPlugin` offers a lighter alternative to `ImageUploadNode` for the blob: URL fix**  
Session 1 recommended adopting the Simple Template's `ImageUploadNode` (atom TipTap Node) to eliminate blob: URLs. Novel.sh shows a second approach: a ProseMirror `Decoration.widget()` plugin. Key difference: Novel's plugin inserts a CSS widget — no node in the document — while `ImageUploadNode` inserts an `atom` node. For Yjs, both eliminate blob: URLs. For UX, `ImageUploadNode` is drag-reorderable during upload; Novel's approach is not. The Session 1 recommendation (`ImageUploadNode`) remains correct. Novel's approach is noted as a lighter fallback if extension complexity is a concern.

**3. Embed paste rules eliminate `window.prompt()` entirely**  
Session 1 noted our Video command uses `window.prompt()` and recommended replacing it with an inline input. Novel.sh shows the full pattern: `addPasteRules()` on the embed node auto-detects pasted URLs (Twitter/X, YouTube) with no dialog at all. Novel's Twitter extension has a working implementation. For Video, add `addPasteRules()` to `VideoEmbedExtension` to detect YouTube/Vimeo URLs on paste. The inline input in the slash menu is still useful for users who type a URL rather than paste one.

**4. `AIHighlight` extension — a missing UX signal during AI generation**  
Novel.sh adds an `AIHighlight` extension that applies a highlight mark to the selected text while AI generation is in progress. When generation completes, `unsetHighlight()` removes it. We have no equivalent: the selected text has no visual state change while the AI is processing, leaving users uncertain whether their selection was captured. `AIHighlight` is a `Highlight.extend({ name: "ai-highlight" })` wrapper — a ten-line extension that adds meaningful perceived quality.

**5. Turn-into via `NodeSelector` in the bubble menu — a complete gap**  
Neither Session 1 nor our current editor has a "turn this block into another type" affordance. Novel.sh provides `NodeSelector` as a `EditorBubble` (bubble menu) item: a popover that lists all block types with the current type checked. Selection uses `editor.chain().focus().clearNodes().toggleHeading(...)`. This is the Notion/Linear block-type-picker pattern. It requires zero schema changes and can be implemented entirely with our existing shadcn `Popover` + `TipTap` commands.

---

### Top 3 MIT Patterns We Can Adapt Directly from Novel.sh

1. **`tiptap-extension-global-drag-handle`** — Install and configure. One pnpm add, ~20 lines of config. Drag handles for all block types with no license cost. Suggested branch: `feat/block-drag-handle`.

2. **Twitter/X embed node** (`packages/headless/src/extensions/twitter.tsx`) — Copy and adapt. Uses `react-tweet`, `nodePasteRule` for auto-detection, `ReactNodeViewRenderer`. Replace `react-tweet` with the app's design-system card if needed. Zero schema migration risk. Suggested branch: `feat/twitter-embed`.

3. **`NodeSelector` turn-into pattern** (`apps/web/components/tailwind/selectors/node-selector.tsx`) — Adapt to our shadcn `Popover` + `EditorBubble` or trigger from the slash command menu. `clearNodes().toggle...` is the correct command chain. Suggested branch: `feat/turn-into-block-selector`.

---

### Top 3 Pro Patterns We Must Reimplement Ourselves

1. **Block drag handle context menu (turn-into, duplicate, delete)** — TipTap Pro's `DragHandle` uses an `onNodeChange` callback to know which node the handle is positioned on, then renders a context menu via Tippy. We can replicate this: `tiptap-extension-global-drag-handle` provides equivalent node tracking. Build the context menu with our shadcn `DropdownMenu`, bound to the drag handle's click event.

2. **Multi-column layout** — `@tiptap-pro/extension-multi-column` has no MIT equivalent. If column layout becomes a requirement for the Notion-style modality, it must be built from scratch or deferred until the Pro license is commercially viable. For now: skip.

3. **Advanced mention UX** — Pro's mention extension supports rich mention cards (avatar, type badge, keyboard selection UX). TipTap free `@tiptap/extension-mention` is functional but minimal. Our Phase 3 mention implementation will use the free extension and build the suggestion UI from original work.

---

## Cross-Reference with Session 1

| S1 Item | S2 Finding |
|---|---|
| `shouldRerenderOnTransaction: false` (must-have) | **REINFORCES** — Pro drag handle source confirms heavy transaction volume under Yjs |
| `SmartTaskItem` appendTransaction Yjs guard (must-have) | **REINFORCES** — No new info from Pro/Novel; S1 analysis stands |
| `ImageUploadNode` adoption (must-have) | **EXTENDS** — Novel shows alternative `UploadImagesPlugin` (Decoration.widget approach). S1 recommendation (`ImageUploadNode` atom node) is still correct for drag-reorder UX; noted as tradeoff |
| `Selection` extension (should-have) | **REINFORCES** — Neither Pro nor Novel override this; S1 stands |
| `enableClickSelection: true` in Link (should-have) | **REINFORCES** — No new info; S1 fix stands |
| Image resize / `width` attribute (should-have) | **EXTENDS** — Novel uses `react-moveable` + `.ProseMirror-selectednode` targeting. Heavy dependency for image resize; our custom handle approach (S1) is lighter |
| `autocapitalize: "off"` (nice-to-have) | **REINFORCES** — Novel also omits it; S1 fix still valid |
| Replace `window.prompt()` for Video (nice-to-have) | **EXTENDS** — Novel shows paste-rule auto-detection pattern; combines with this fix |
| Keyboard shortcut hints (nice-to-have) | **NO COVERAGE** — Neither Pro nor Novel has shortcut hints; S1 recommendation stands |
| `@tiptap/extension-list` consolidation (nice-to-have) | **REINFORCES** — Novel uses the separate packages too; consolidation still low-priority |
| Code block language selector + copy button (nice-to-have) | **NO COVERAGE** — Novel uses `highlight.js` applied after serialization, not a block UI |
| Mobile toolbar contextual sub-views (nice-to-have) | **REINFORCES** — Pro/Novel have no mobile toolbar patterns |
| `EditorContext.Provider` refactor (nice-to-have) | **EXTENDS** — Novel uses `EditorProvider` (different pattern). Both justify `useCurrentEditor()`; our current prop-drilling is the one gap |
| Desktop block drag handle (nice-to-have, deferred to S2) | **EXTENDS** — **Key S2 finding**: MIT path via `tiptap-extension-global-drag-handle` confirmed; effort drops from High to Low-Medium |

---

## Gap-by-Gap Detail

---

### Gap 1: Block-Level Controls (+ Hover Row)

**What Pro does:**  
The compiled `@tiptap-pro/extension-drag-handle` source shows the full pattern: a ProseMirror plugin listens to `mousemove` on the editor, walks the DOM to identify the nearest block element (`c()` helper), then positions a Tippy tooltip to the `left-start` of that element. The tooltip's content is the drag handle element (whatever HTML the `render()` option provides). This is both the drag grip AND the + button — the handle element renders both.

**What Novel.sh does:**  
Uses `tiptap-extension-global-drag-handle` (MIT, `GlobalDragHandle` in `packages/headless/src/extensions/index.ts`). Lighter implementation — a `div.drag-handle` absolutely positioned via a simpler algorithm. No Tippy dependency. No context menu. The handle element itself is the entire block-level control.

**What we do:**  
Nothing. No per-block hover controls on desktop.

**Gap:**  
Complete gap for desktop. Mobile block controls via `SwipeIndentExtension` (touch swipe to indent) exist, but no visual per-block handle.

**Roadmap context:**
- Yjs: `tiptap-extension-global-drag-handle` produces standard `tr.delete / tr.insert` transactions. Safe. Verify the package doesn't react incorrectly to remote Yjs transactions (check for `getMeta('y-sync$')` handling if needed).
- Excalidraw: Any canvas node should set `draggable: false` on its TipTap node to prevent the drag handle from triggering. The engine-opaque `canvas_doc` node should be `atom: true, draggable: false`.
- Capacitor: HTML5 DnD API is unreliable in iOS WebView. `tiptap-extension-global-drag-handle` uses `dragstart` / `drop` events. Touch-drag may require `touch-action: none` + long-press-to-drag polyfill for Capacitor builds.
- Vibe: Handle div is CSS-only. Vibe motion curves and palette can be applied via CSS variables.
- NTS: Relevant for Notion-style modality. Hide via CSS `[data-nts-modality="paper"] .drag-handle { display: none }` for paper and unlimited-scroll modalities.

**S1 cross-ref:** EXTENDS S1 — S1 said "defer to S2; evaluate TipTap Pro." S2 confirms MIT path.  
**Priority:** nice-to-have-anytime  
**Effort:** Low-Medium (single package install + context menu custom build)  
**Implementation source:** `tiptap-extension-global-drag-handle` (MIT)

---

### Gap 2: Drag Handles and Drag Context Menu

**What Pro does:**  
The compiled DragHandle source reveals the full behavior:
- `onNodeChange` callback fires when the hovered node changes — passes `{ editor, node, pos }`.
- Commands: `lockDragHandle`, `unlockDragHandle`, `toggleDragHandle` — used to keep the handle visible while a context menu is open.
- `dragstart` handler uses `NodeRangeSelection.create()` to select the full block, sets `dataTransfer` drag image (a clone of the block's DOM with computed styles).
- Yjs awareness: imports `isChangeOrigin` from `@tiptap/extension-collaboration` and `ySyncPluginKey` from `y-prosemirror` — maps positions via `absolutePositionToRelativePosition` so the handle stays correct during remote peer edits.
- Uses Tippy.js internally (`appendTo: parentElement`).
- Context menu UX (turn-into, duplicate, delete): the `onNodeChange` callback is how Pro's Notion-like template builds the context menu — the template renders a React dropdown at the handle position when clicked, using the `pos` from `onNodeChange` to know which node to operate on.

**What Novel.sh does:**  
`GlobalDragHandle` from `tiptap-extension-global-drag-handle` — simpler, no Tippy, no Yjs-aware position mapping, no `onNodeChange`. Handles basic DnD only.

**What we do:**  
Nothing.

**Gap:**
- DnD: MIT path exists (`tiptap-extension-global-drag-handle`). Covers the common case.
- Context menu: needs custom implementation. Pattern: add an `onClick` handler to the handle element; render a shadcn `DropdownMenu` (or `Popover`) with items: Turn into (→ NodeSelector popover), Duplicate block, Delete block, Copy block link (future).
- Yjs position stability: Pro's Yjs-aware position mapping is a nice-to-have under collaboration. The MIT package doesn't have it, so the handle may momentarily show on the wrong block after a remote peer inserts content. This is a cosmetic glitch, not a data safety issue.

**Roadmap context:**  
Same as Gap 1 plus: the context menu must use `tr.pos` derived from `onNodeChange` carefully under Yjs — the position may have shifted since `onNodeChange` fired. Use `editor.view.state.doc.resolve()` at command execution time, not at menu-open time.

**S1 cross-ref:** EXTENDS S1  
**Priority:** nice-to-have-anytime  
**Effort:** Medium (GlobalDragHandle install is Low; context menu build is Medium)  
**Implementation source:** `tiptap-extension-global-drag-handle` (MIT) + original context menu

---

### Gap 3: Multi-Column Layout with Resize

**What Pro does:**  
`@tiptap-pro/extension-multi-column` (not installed in this study — Pro-only, no source available). From TipTap documentation: side-by-side columns, drag-to-resize column widths, nested blocks within each column. Column widths stored as percentage attributes.

**What Novel.sh does:**  
Not present.

**What we do:**  
Not present.

**Gap:**  
Complete gap. No MIT implementation path exists.

**Roadmap context:**
- Excalidraw: Multi-column conflicts with canvas embedding — a canvas block within a column would make the canvas engine's coordinate system ambiguous. **Flag: multi-column and Excalidraw should not coexist in the same note without careful isolation.**
- NTS: Only relevant for Notion-style modality. Paper and unlimited-scroll modalities should never expose column controls.
- Yjs: Column width as a percentage attribute would be a JSON primitive. Safe if ever implemented.

**S1 cross-ref:** NO COVERAGE  
**Priority:** skip (no MIT path; Pro is license-restricted; Excalidraw conflict risk)  
**Effort:** High

---

### Gap 4: Turn-Into Dropdown (Block Type Conversion)

**What Pro does:**  
Part of the drag handle context menu. "Turn into" submenu lists all block types. Clicking an item calls the appropriate toggle command for the node at the handle's tracked position.

**What Novel.sh does:**  
`NodeSelector` component (`apps/web/components/tailwind/selectors/node-selector.tsx`). Lives in `EditorBubble` (bubble menu on text selection). A `Popover`-triggered list showing all block types. The active type is checked. Command: `editor.chain().focus().clearNodes().toggleHeading({ level: N }).run()`. Uses `EditorBubbleItem` wrapper which calls the command and closes the bubble. The `clearNodes()` call before toggle ensures clean type conversion regardless of current block type.

**What we do:**  
Not present. Block type changes require knowing the slash command shortcuts or using the toolbar heading dropdown (headings only).

**Gap:**  
Meaningful UX gap. Users have no discoverable way to change a paragraph to a heading mid-document without the slash menu or toolbar. Novel's `NodeSelector` is the cleanest MIT-licensed solution.

**Roadmap context:**
- Yjs: `clearNodes().toggle...` chains produce standard transactions. Fully Yjs-safe.
- Capacitor: Popover must handle keyboard avoidance on mobile; use shadcn `Popover` with the app's existing viewport-aware positioning.
- Vibe: Popover content fully themeable.
- NTS: Universal across all modalities.

**S1 cross-ref:** NO COVERAGE  
**Priority:** should-have-before-Yjs — not Yjs-critical, but expected UX that improves editor comprehensibility; easier to add before the Yjs refactor touches the command layer.  
**Effort:** Low (adapt Novel's `NodeSelector`; no new extensions required)  
**Implementation source:** Novel's `NodeSelector` pattern (MIT)

---

### Gap 5: Mentions (@mention)

**What Pro does:**  
`@tiptap-pro/extension-mention` (not installed). Pro's mention UX: avatar in the suggestion list, type badges (person/page/block), keyboard selection. More polished than the free extension.

**What Novel.sh does:**  
Not present.

**What we do:**  
Not implemented. Queued for Phase 3. TipTap free `@tiptap/extension-mention` is available.

**Gap:**  
Feature not yet built. No new S2 insight beyond confirming Novel doesn't provide a reference implementation — we'll build it from the free TipTap extension.

**Roadmap context:**
- Yjs: `mention` node stores `id` and `label` as string attributes — JSON-primitive-safe.
- NTS: Relevant primarily for Notion-style modality (linked references); paper modality needs no mention support.

**S1 cross-ref:** NO COVERAGE  
**Priority:** nice-to-have-anytime (Phase 3 feature, not Yjs-blocking)  
**Effort:** Medium  
**Implementation source:** `@tiptap/extension-mention` (free TipTap) + original suggestion UI

---

### Gap 6: Slash Menu — Advanced Patterns

**What Pro does:**  
Pro's Notion-like template has a slash menu with categories (unknown detail — template source not in public repo). Expected: grouped items, recent items, search ranking.

**What Novel.sh does:**  
`packages/headless/src/extensions/slash-command.tsx` uses TipTap's `Suggestion` extension. Flat list, no categories. `SuggestionItem` interface includes `searchTerms?: string[]` — aliases for fuzzy search beyond the `title`. `handleCommandNavigation` helper intercepts `ArrowUp`, `ArrowDown`, `Enter` events and returns `true` when `#slash-command` is in the DOM, preventing the editor from consuming these keys. Code block detection: skips slash menu when `parentNode.type.name === "codeBlock"`. `createSuggestionItems` is a typed helper that returns `SuggestionItem[]` — allows consumers to define commands without subclassing the extension.

**What we do:**  
Custom `SlashCommandExtension` (ProseMirror Plugin + `PluginKey`) + `SlashCommandMenu` (React, `AnimatePresence`, keyboard navigation, scroll-into-view). 17 commands. Flat list. Query string matches `label` only — no alias search terms. Code block: not explicitly checked (verify whether our plugin fires inside a code block).

**Gap:**
- Search aliases (`searchTerms` array): our commands match only on `label`. Adding `searchTerms` improves discoverability (e.g., `/h1` finds "Heading 1").
- Code block guard: verify our plugin suppresses itself inside a code block; Novel explicitly checks `blockType === "codeBlock"`.

**Roadmap context:**
- Yjs: Slash command state is view-local. Safe.
- Capacitor: Tippy placement `bottom-start` needs viewport bounds on small screens. Our current `AnimatePresence` positioned menu handles this via CSS.

**S1 cross-ref:** EXTENDS S1 — S1 found we exceed Simple Template; Novel adds search alias pattern and code block guard.  
**Priority:** nice-to-have-anytime  
**Effort:** Low (add `searchTerms` array to each command; add code block guard)

---

### Gap 7: Floating Bubble Menu (Selection-Based Formatting)

**What Pro does:**  
Pro's Notion-like template includes a floating bubble menu on text selection (standard in Notion-style editors). Unknown exact feature set — template source not in public repo.

**What Novel.sh does:**  
`EditorBubble` (`packages/headless/src/components/editor-bubble.tsx`) wraps TipTap's `BubbleMenu`. Shows `NodeSelector` + `LinkSelector` + `TextButtons` + `ColorSelector` + `MathSelector` + `GenerativeMenuSwitch` ("Ask AI"). `shouldShow` returns false for image node selections, empty selections, and non-editable editors. Key innovation: `GenerativeMenuSwitch` morphs the bubble content — when "Ask AI" is clicked, the entire bubble replaces its formatting controls with `AISelector`.

**What we do:**  
Fixed top toolbar (desktop) + fixed bottom toolbar (mobile, keyboard-aware). `AiSelectionMenu` and `MobileSelectionMenu` are custom floating components for AI actions on text selection — not a `BubbleMenu`. No standard formatting bubble.

**Gap:**  
We have no `BubbleMenu`. Our fixed toolbar is always visible, which reduces the need for a bubble, but the bubble's `NodeSelector` (turn-into) and inline AI invocation patterns add UX density that the toolbar can't provide. The `GenerativeMenuSwitch` pattern — morphing from formatting to AI in one surface — is a notable UX advancement over our separate floating AI menu. Note: adding a bubble menu does NOT replace the fixed toolbar; they coexist (Notion has both).

**Roadmap context:**
- Yjs: BubbleMenu is view-only. Fully Yjs-safe.
- Vibe: BubbleMenu Tippy popup needs CSS variable theming.
- NTS: Universal — all modalities benefit from inline formatting access.
- Capacitor: Bubble menu on touch selection is standard iOS pattern; TipTap's `BubbleMenu` handles `selectionchange` events correctly in WebView.

**S1 cross-ref:** EXTENDS S1 — S1 noted no BubbleMenu; Novel shows the integrated AI+formatting bubble pattern is more powerful than a fixed-toolbar-only approach.  
**Priority:** nice-to-have-anytime  
**Effort:** Medium  
**Implementation source:** Novel's `GenerativeMenuSwitch` + `NodeSelector` pattern adapted with our shadcn components

---

### Gap 8: Tables (Advanced)

**What Pro does:**  
Richer table UX (column headers, better cell navigation, type-based column controls). Unknown implementation detail — template source not available.

**What Novel.sh does:**  
Not present. No `@tiptap/extension-table` in Novel's extension stack.

**What we do:**  
Full `@tiptap/extension-table` with resizable columns. Slash command inserts 3×3 table with header row.

**Gap:**  
We significantly exceed both reference sources. No action.

**S1 cross-ref:** REINFORCES S1  
**Priority:** skip (we lead)

---

### Gap 9: Embed Blocks (YouTube, Twitter, Figma)

**What Pro does:**  
YouTube, Twitter/X, and Figma embeds (assumed from Notion-like template feature list). Implementation unknown.

**What Novel.sh does:**  
- **Twitter/X** (`packages/headless/src/extensions/twitter.tsx`): Custom TipTap `Node`, `draggable: true`, `ReactNodeViewRenderer(TweetComponent)`. `TweetComponent` renders `react-tweet`'s `<Tweet id={tweetId} />`. `addPasteRules()` uses `nodePasteRule` with TWITTER_REGEX_GLOBAL to auto-insert on paste. Full implementation, MIT-licensed.
- **YouTube**: Standard `@tiptap/extension-youtube` (already used by us).
- `extensions.ts` shows both configured with `inline: false`.

**What we do:**  
`VideoEmbedExtension` handles YouTube and Vimeo. No Twitter/X. No Figma. Video insertion uses `window.prompt()` for URL input (S1 Gap #1). No paste rule auto-detection.

**Gap:**
1. **Twitter/X embed**: Complete gap. Novel provides a working MIT implementation with `react-tweet`.
2. **Paste-rule auto-detection**: Novel shows how `addPasteRules([nodePasteRule({ find: REGEX, type: this.type, getAttributes: match => ({ src: match.input }) })])` eliminates the dialog for URL-pasted embeds. Applicable to our `VideoEmbedExtension`.
3. **Figma embed**: No MIT source. Skip for now or build as a generic iframe-embed node.

**Roadmap context:**
- Yjs: `src` attribute is a string primitive. Fully Yjs-safe.
- Excalidraw: Embed nodes are leaf nodes and coexist safely with canvas nodes.
- Capacitor: `react-tweet` renders iframes which may have WebView restrictions. Verify `react-tweet` works in a Capacitor WebView.
- NTS: Embeds relevant for all modalities.

**S1 cross-ref:** EXTENDS S1 — S1 noted `window.prompt()` issue; S2 identifies full paste-rule pattern.  
**Priority:** nice-to-have-anytime  
**Effort:** Low (Twitter: adapt Novel's extension; Video paste rules: add to existing extension)  
**Implementation source:** Novel's Twitter extension (MIT); paste-rule pattern from Novel

---

### Gap 10: AI Command UX (Novel.sh Strength)

**What Pro does:**  
TipTap AI extension (Pro-tier, requires TipTap AI proxy service). Not studied in this session — license-restricted.

**What Novel.sh does:**  
A four-component AI system:
1. `AIHighlight` extension — `Highlight.extend({ name: "ai-highlight" })` — applies a yellow-ish highlight mark to selected text when `addAIHighlight(editor)` is called. Removed on `removeAIHighlight(editor)` / `unsetHighlight()`.
2. `GenerativeMenuSwitch` — wraps `EditorBubble`. When "Ask AI" clicked: switches bubble content to `AISelector`. On close: `removeAIHighlight`.
3. `AISelector` — `Command` + `CommandInput`. States: no-completion (shows `AISelectorCommands`) and has-completion (shows `AICompletionCommands`). Uses Vercel AI SDK `useCompletion` hook for streaming. Completion rendered as `<Markdown>` in a `ScrollArea`.
4. `AISelectorCommands` — "Improve writing", "Fix grammar", "Make shorter", "Make longer", "Continue writing". `AICompletionCommands` — "Replace selection", "Insert below", "Discard".
5. API: Edge function (`/api/generate`) handles options: `continue`, `improve`, `shorter`, `longer`, `fix`, `zap` (custom command). Uses OpenAI `gpt-4o-mini`, rate-limited via Upstash.

**What we do:**  
`AiSelectionMenu` (desktop, custom positioned floating div using `getBoundingClientRect`). Multiple action groups (`ai-action-groups.tsx`). Custom instruction input (`customInputFor`/`customText` state). Uses `use-ai-action.ts` for the actual API call with our BYOK/free-tier Gemini backend. `AiStatusIndicator` for streaming status. `onBeforeAiRewrite` callback for version snapshot. More comprehensive than Novel's AI UX but less elegantly integrated (separate floating component vs. bubble morphing).

**Gap:**
1. **`AIHighlight` extension**: We don't highlight selected text during AI generation. Minor UX improvement, simple to add.
2. **Accept/reject UI (replace / insert below / discard)**: Our AI writes directly into the editor — verify we have a clear discard path. Novel's explicit three-button UI is clearer.
3. **Bubble-integrated AI**: Novel's morphing bubble is more cohesive than our separate floating menu. Low priority given we have a working AI flow.
4. **No Vercel AI SDK dependency needed** — our BYOK Gemini approach is superior to Novel's OpenAI-locked setup.

**Roadmap context:**
- Yjs: `AIHighlight` is a mark decoration. Under Yjs, if a remote peer edits while AI is generating, the highlight boundaries may drift. This is cosmetic only — the highlight is removed after generation. Safe.
- Vibe: highlight color should use `--primary` accent or a dedicated `--ai-highlight` CSS variable.

**S1 cross-ref:** NO COVERAGE  
**Priority:** nice-to-have-anytime  
**Effort:** Low (`AIHighlight` extension — 10 lines; accept/reject UI — Medium)  
**Implementation source:** `AIHighlight` — original work following Novel's pattern; accept/reject UI — novel adaptation

---

### Gap 11: Magic Editing Patterns (Novel.sh)

Novel.sh's "magic editing" is the same AI command system as Gap 10 — no separate pattern. The `AISelectorCommands` options (improve, shorten, fix grammar) are the magic editing primitives. Covered by Gap 10.

**S1 cross-ref:** NO COVERAGE (subsumed by Gap 10)  
**Priority:** skip (covered by Gap 10)

---

### Gap 12: Mobile and Touch Patterns

**What Pro does:**  
No mobile-specific patterns visible from compiled DragHandle source (uses standard pointer events).

**What Novel.sh does:**  
No mobile-specific handling. Novel's `advanced-editor.tsx` has no `useIsMobile`, no keyboard height tracking, no mobile toolbar. Desktop-only demo.

**What we do:**  
Comprehensive mobile handling — `useBreakpoint()`, `ScrollableToolbar`, `ensureCursorVisible` (container-walking scroll), `MobileSelectionMenu`, Android keyboard dismiss detection, native context menu suppression, `keyboardHeight` bottom-toolbar positioning.

**Gap:**  
None. We lead both reference sources by a wide margin. Session 1 analysis stands.

**S1 cross-ref:** REINFORCES S1  
**Priority:** skip (we lead)

---

### Gap 13: Performance Patterns

**What Pro does:**  
The compiled DragHandle adds a Tippy.js dependency (~12KB compressed). Uses `mousemove` event on the editor DOM for node tracking — one handler, low cost. The handle visibility animation uses Tippy's `duration: 100` transition — a CSS opacity transition, GPU-composited.

**What Novel.sh does:**  
- Uses `EditorProvider` from `@tiptap/react` instead of `useEditor()` hook. `EditorProvider` re-renders differently than `useEditor()` — it uses React Context. This is the same architectural pattern as using `EditorContext.Provider` (S1 Gap #18).
- `react-moveable` for image resize: ~60KB compressed. Heavy for a single use case; consider custom pointer-event resize handles instead.
- `tiptap-extension-global-drag-handle`: lightweight ProseMirror plugin, no third-party positioning library.
- No `shouldRerenderOnTransaction: false` visible in Novel's `EditorContent` — likely a bug in Novel's own editor that it avoids because `EditorProvider` has different re-render semantics.

**What we do:**  
`useEditor()` with `useMemo` extension array, `immediatelyRender: false`. Missing `shouldRerenderOnTransaction: false` (S1 critical finding).

**Gap:**  
S1 already identified the key performance gap (`shouldRerenderOnTransaction: false`). S2 observations:
- Avoid `react-moveable` for image resize — use custom `onPointerDown` + `pointermove` resize handles in `ImageNodeView` instead.
- `tiptap-extension-global-drag-handle` is lightweight (good choice over Pro's Tippy-based handle).

**S1 cross-ref:** REINFORCES S1  
**Priority:** skip for new items (S1 `shouldRerenderOnTransaction` flag is the fix)

---

### Gap 14: Anything Session 1 Missed or Under-Covered

**14a. MIT drag handle path now confirmed**  
S1 deferred drag handles to S2 citing the need to evaluate TipTap Pro. S2 confirms: `tiptap-extension-global-drag-handle` (MIT) is the implementation path. TipTap Pro's handle is feature-richer but license-restricted. The MIT package covers basic DnD; custom context menu fills the rest.

**14b. `handleDrop` for image files — Novel provides the pattern**  
S1 noted our global `paste` listener doesn't handle drag-drop image files. Novel exports `handleImageDrop` from `packages/headless/src/plugins/upload-images.tsx`:  
```ts
export const handleImageDrop = (view, event, moved, uploadFn) => {
  if (!moved && event.dataTransfer?.files.length) {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
    uploadFn(file, view, coordinates?.pos ?? 0 - 1);
    return true;
  }
  return false;
};
```
Pass this to `editorProps.handleDrop` alongside `handleImagePaste`. Should be added when implementing `ImageUploadNode` (S1 must-have).

**14c. Novel's `UploadImagesPlugin` vs Simple Template's `ImageUploadNode`**  
Two different placeholder approaches for blob: URL elimination:
- Simple Template: `atom` TipTap Node — placeholder is a document node, drag-reorderable during upload, visible to ProseMirror, serializable to JSON with no dangerous content (no `src` until upload completes).
- Novel: `Decoration.widget()` ProseMirror Plugin — placeholder is a CSS widget, NOT a document node. Invisible to Yjs serialization (decorations aren't in the document). Cleaner for Yjs but not drag-reorderable.  
**Recommendation stands as S1**: `ImageUploadNode` (atom node approach) is correct for our use case. Novel's plugin is noted as a lighter alternative.

**14d. `EditorCommandTunnelContext` (Novel's portal pattern)**  
Novel uses `tunnel-rat` to render the slash command menu in a React portal while keeping it inside the editor's React tree (for proper `useCurrentEditor()` context access). Our current `SlashCommandMenu` renders via `ReactRenderer` + Tippy (TipTap's official pattern). Both work; the tunnel-rat approach is more React-idiomatic. Not worth switching.

**14e. Code block highlighting approach**  
Novel uses `highlight.js` applied post-serialization (`highlightCodeblocks(editor.getHTML())`), not `CodeBlockLowlight`. This means no live syntax highlighting while typing. We use `CodeBlockLowlight` (real-time highlighting). We're ahead — no change needed.

---

## Combined Triaged Backlog

Single source of truth for the implementation queue. S1 items marked **[S1]**, new S2 items marked **[S2]**, items where S2 changes S1's assessment marked **[S1→S2]**.

Sorted: must-have → should-have → nice-to-have, then Low → Medium → High effort within each tier.

| Item | Source | Priority | Effort | Yjs notes | Excalidraw notes | Capacitor notes | Vibe notes | NTS notes | Implementation source | Suggested branch |
|---|---|---|---|---|---|---|---|---|---|---|
| `shouldRerenderOnTransaction: false` in `useEditor()` | S1 | must-have-before-Yjs | Low | Yjs fires many tx/sec; missing this causes React re-render storms on remote typing | N/A | N/A | N/A | N/A | Config change in `GrapheEditor.tsx` | `fix/editor-rerender-optimization` |
| `SmartTaskItem.appendTransaction` Yjs guard (`y-sync$` check) | S1 | must-have-before-Yjs | Low | appendTransaction fires on remote tx → concurrent sort conflicts | N/A | N/A | N/A | N/A | One-line guard in `SmartTaskItem.ts` | `fix/smart-task-item-yjs-compat` |
| Adopt `ImageUploadNode` block-placeholder + `handleDrop` | S1 + S2 | must-have-before-Yjs | Medium | blob: URLs non-serializable; y-prosemirror can't sync them | N/A | handleDrop works in WebView ✓ | N/A | N/A | Novel's `handleImageDrop` + Simple Template's `ImageUploadNode` pattern | `feat/image-upload-node` |
| `Selection` extension (brand-color text selection) | S1 | should-have-before-Yjs | Low | CSS decoration only; zero Yjs impact | N/A | N/A | Use `--primary` at 25% opacity | N/A | `@tiptap/extensions` package | `fix/editor-selection-extension` |
| `enableClickSelection: true` in Link config | S1 | should-have-before-Yjs | Low | Config-only change | N/A | N/A | N/A | N/A | `GrapheEditor.tsx` Link config | `fix/link-click-selection` |
| Turn-into / `NodeSelector` block type picker | S2 | should-have-before-Yjs | Low | `clearNodes().toggle` = standard tx ✓ | N/A | Popover needs keyboard avoidance | Popover themeable ✓ | All modalities ✓ | Adapt Novel's `NodeSelector` (MIT) | `feat/turn-into-block-selector` |
| Image resize (`width` attribute + drag handles) | S1 | should-have-before-Yjs | High | Adding post-Yjs requires schema migration; `width` int is primitive ✓ | N/A | Pointer events work in WebView ✓ | N/A | N/A | Custom `onPointerDown` in `ImageNodeView` — avoid `react-moveable` | `feat/image-resize` |
| `autocapitalize: "off"` in `editorProps.attributes` | S1 | nice-to-have-anytime | Low | No Yjs impact | N/A | Fixes iOS auto-cap ✓ | N/A | N/A | One attribute in `GrapheEditor.tsx` | bundle into nearby PR |
| Add `searchTerms` aliases to slash commands | S2 | nice-to-have-anytime | Low | No Yjs impact | N/A | N/A | N/A | N/A | Extend `SLASH_COMMANDS` array in `SlashCommandMenu.tsx` | `fix/slash-search-aliases` |
| Code block guard in slash command extension | S2 | nice-to-have-anytime | Low | No Yjs impact | N/A | N/A | N/A | N/A | Add `codeBlock` type check to `SlashCommandExtension` | bundle into `fix/slash-search-aliases` |
| Replace `window.prompt()` for Video + add paste-rule auto-detect | S1 + S2 | nice-to-have-anytime | Low | No Yjs impact | N/A | N/A | N/A | N/A | Inline URL input in slash menu + `addPasteRules` in `VideoEmbedExtension` | `fix/slash-video-modal` |
| `AIHighlight` extension during generation | S2 | nice-to-have-anytime | Low | Highlight mark must be in schema before Yjs; drift under remote edit is cosmetic only | N/A | N/A | Use `--primary` or `--ai-highlight` var | N/A | Original work, 10 lines | bundle into AI PR |
| Twitter/X embed node | S2 | nice-to-have-anytime | Low | `src` string primitive ✓; `draggable: true` produces standard tx ✓ | N/A | Verify `react-tweet` in Capacitor WebView | N/A | All modalities | Novel's Twitter extension (MIT) | `feat/twitter-embed` |
| Keyboard shortcut hints in toolbar tooltips | S1 | nice-to-have-anytime | Low | No Yjs impact | N/A | N/A | N/A | N/A | Port Simple Template's `formatShortcutKey` | `feat/toolbar-shortcut-hints` |
| `@tiptap/extension-list` package consolidation | S1 | nice-to-have-anytime | Low | No impact | N/A | N/A | N/A | N/A | Import swap in `GrapheEditor.tsx` | bundle into chore PR |
| Desktop block drag handle (`tiptap-extension-global-drag-handle`) | S1→S2 | nice-to-have-anytime | Low-Med | Standard tx ✓; MIT package may lack Yjs position stability | Canvas node: `draggable: false` | touch-drag needs polyfill for Capacitor | Handle div: CSS-only ✓ | Hide for non-Notion modalities | `tiptap-extension-global-drag-handle` (MIT) | `feat/block-drag-handle` |
| Code block language selector + copy button | S1 | nice-to-have-anytime | Medium | `language` string primitive ✓ | N/A | N/A | N/A | N/A | Custom React NodeView for `CodeBlockLowlight` | `feat/code-block-ux` |
| Drag handle context menu (turn-into, duplicate, delete) | S2 | nice-to-have-anytime | Medium | Use current position from `onNodeChange`; re-resolve at command time | Canvas node excluded from context menu | Touch long-press trigger | Menu: shadcn DropdownMenu ✓ | Notion-style only | Original work + shadcn `DropdownMenu` | bundle with `feat/block-drag-handle` |
| `EditorContext.Provider` / `useCurrentEditor` refactor | S1 | nice-to-have-anytime | Medium | No Yjs impact | N/A | N/A | N/A | N/A | Wrap editor in `EditorContext.Provider` | `refactor/editor-context-provider` |
| Bubble menu with integrated AI switch | S2 | nice-to-have-anytime | Medium | View-only ✓ | N/A | Standard on touch selection ✓ | Tippy popup needs CSS vars | All modalities | Adapt Novel's `GenerativeMenuSwitch` with shadcn | `feat/bubble-menu` |
| Mobile toolbar contextual sub-views | S1 | nice-to-have-anytime | Medium | No Yjs impact | N/A | N/A | N/A | N/A | Port Simple Template's sub-view pattern for high-density controls | `refactor/mobile-toolbar-subviews` |
| Mentions extension (@mention) | S2 | nice-to-have-anytime | Medium | `id`/`label` string primitives ✓ | N/A | Suggestion popover needs touch support | N/A | Notion-style primarily | `@tiptap/extension-mention` (free) + original suggestion UI | `feat/mentions` |
| AI accept/reject UI (replace / insert below / discard) | S2 | nice-to-have-anytime | Medium | N/A | N/A | N/A | N/A | N/A | Adapt Novel's `AICompletionCommands` | bundle into AI PR |
| Multi-column layout | S2 | skip | High | Percentage width primitive ✓ but complex CRDTs under Yjs | **Conflicts with Excalidraw canvas blocks** | N/A | N/A | Notion-style only | No MIT path | skip |

---

## Patterns We Should NOT Adopt

**1. `react-moveable` for image resize**  
Novel uses `react-moveable` (~60KB compressed) to implement image resize. It targets `.ProseMirror-selectednode` directly (no TipTap NodeView integration), calls `editor.commands.setImage()` on resize end, and uses TipTap's built-in `@tiptap/extension-image`'s `setImage` command. This approach:
- Doesn't integrate with our `CustomImage` node's attributes (`masterPath`, `attachmentId`, `downloadUrl`, `isAnimated`).
- Modifies DOM styles that conflict with our `ImageNodeView`'s React render.
- Adds a large dependency for a feature we can build with 40 lines of `onPointerDown + pointermove` in `ImageNodeView`.
Use custom resize handles instead.

**2. Novel's `UploadImagesPlugin` (Decoration approach) over `ImageUploadNode` (atom node)**  
Novel's decoration plugin is conceptually clean but the upload placeholder isn't a document node — it can't be drag-reordered, it's not accessible to screen readers, and if the user switches notes mid-upload the decoration disappears. `ImageUploadNode` as an atom TipTap node persists properly in the document model. The atom approach is correct for a production notes app.

**3. Novel's `EditorProvider` instead of `useEditor()`**  
Novel wraps the editor in `<EditorRoot><EditorContent>` (`EditorProvider` underneath). This is a different component model than our `useEditor()` hook. Migrating to `EditorProvider` would require restructuring the entire `GrapheEditor` / `NoteShell` / `QuickBitShell` hierarchy. The hook approach with explicit `useMemo` extension array is stricter and gives us more control. Don't adopt.

**4. `tunnel-rat` for slash command portal**  
Novel uses `tunnel-rat` to render the slash command menu inside the editor's React tree while physically rendering it in a portal. Our Tippy/ReactRenderer approach is TipTap's official pattern and doesn't require an additional portal library. Don't introduce `tunnel-rat`.

**5. Vercel AI SDK (`useCompletion` from `ai/react`) for our AI flow**  
Novel uses the Vercel AI SDK with OpenAI. Our BYOK Gemini architecture is superior for our use case (free tier for users, user-provided keys). Don't replace our AI stack with Novel's.

**6. Novel's flat slash command list for our command catalog**  
Novel's slash menu has ~8 items. We have 17 commands and will grow. Novel's flat single-column list doesn't scale. Our current design with scroll and keyboard navigation is correct. What we can adopt from Novel is the `searchTerms` alias pattern, not the list structure.

---

## Surprises and Clever Bits

**`tiptap-extension-global-drag-handle` is MIT, actively maintained, and used in production by Novel.sh.**  
The assumption going into Session 2 was that drag handles require TipTap Pro. Novel.sh proves otherwise. `tiptap-extension-global-drag-handle` is a standalone ProseMirror plugin with no Pro dependency. The Pro drag handle has more features (Tippy positioning, Yjs awareness, NodeRangeSelection for multi-block DnD), but the MIT package handles the 95% case.

**Novel's bubble menu morphs into an AI panel — the same surface does two jobs.**  
`GenerativeMenuSwitch` toggles the `EditorBubble`'s entire content between formatting tools and the AI input. There's no second floating element. When AI is open, the bubble expands to show the `AISelector`; when closed, it collapses back to formatting controls. This is more elegant than two separate floating elements (our approach). The key trick: `tippyOptions.placement` switches from `"top"` (compact formatting bar) to `"bottom-start"` (expanded AI panel) programmatically via `useEffect`.

**Novel's `AIHighlight` is 10 lines — one of the simplest extensions in TipTap.**  
```ts
const AIHighlight = Highlight.extend({ name: "ai-highlight" });
```
Applied by `addAIHighlight(editor)` which calls `editor.chain().setHighlight({ color: "#8590FA" }).run()`. Removed by `removeAIHighlight(editor)` which calls `editor.chain().unsetHighlight().run()`. The entire perceived quality improvement of "the AI knows what text I selected" is 10 lines of code.

**TipTap Pro's `DragHandle` is Yjs-aware; the MIT package is not.**  
The compiled Pro source imports from `@tiptap/extension-collaboration` (`isChangeOrigin`) and `y-prosemirror` (`ySyncPluginKey`, `absolutePositionToRelativePosition`). When a remote peer inserts content, the Pro handle remaps its tracked block position via `absolutePositionToRelativePosition`. The MIT `tiptap-extension-global-drag-handle` has no such mapping — under Yjs, the handle may momentarily show on the wrong block. This is cosmetic and recovers on the next `mousemove`. Worth documenting but not a blocker.

**Novel's `NodeSelector` uses `clearNodes()` before every block type toggle — the correct idiom.**  
Most naive implementations call `toggleHeading({ level: 2 })` directly, which toggles relative to the current state and can leave orphaned styles. `clearNodes()` first resets to a plain paragraph, then the toggle applies cleanly regardless of the current block type. This is the Notion/Linear pattern and should be used in all our block type conversion commands.

**The public `tiptap-ui-components` repo has no Notion-like template.**  
The Notion-like template is exclusively behind the Pro subscription — not even the source is in the public repo. The `apps/web/src/components/tiptap-templates/` directory contains only `simple/`. Any assumption that the Notion-like template source was accessible for study was incorrect. The analysis of Pro patterns in this report is based on: (a) installed package compiled source, (b) TipTap documentation, (c) Novel.sh's community re-implementations.

---

## License Boundary Log

Each item in the combined backlog is explicitly traced to a production-safe source:

| Item | Production implementation source | Pro code used? |
|---|---|---|
| `shouldRerenderOnTransaction: false` | Config change — original work | No |
| `SmartTaskItem` Yjs guard | One-line fix — original work | No |
| `ImageUploadNode` + `handleDrop` | Simple Template source (`tiptap-ui-components`, MIT) + Novel `handleImageDrop` (MIT) | No |
| `Selection` extension | `@tiptap/extensions` (free TipTap, MIT) | No |
| `enableClickSelection: true` | Config change — original work | No |
| Turn-into / `NodeSelector` | Adapted from Novel's `node-selector.tsx` (MIT) | No |
| Image resize | Original `onPointerDown + pointermove` in `ImageNodeView` | No |
| Desktop block drag handle | `tiptap-extension-global-drag-handle` (MIT, npm) | No |
| Drag handle context menu | Original work with shadcn `DropdownMenu` | No |
| Twitter/X embed | Adapted from Novel's `twitter.tsx` (MIT) | No |
| `AIHighlight` extension | Original work following Novel's `ai-highlight.ts` pattern (MIT) | No |
| Video paste rules | Original `addPasteRules()` implementation in `VideoEmbedExtension` | No |
| Search aliases in slash commands | Original additions to `SLASH_COMMANDS` array | No |
| Bubble menu | Original work adapting Novel's `GenerativeMenuSwitch` pattern (MIT) | No |
| Mentions | `@tiptap/extension-mention` (free TipTap, MIT) + original suggestion UI | No |

**Confirmation:** No TipTap Pro extension code (`@tiptap-pro/*`) will enter `artifacts/next-app/src/` or any production-deployed path. The Pro packages installed at `study/tiptap-pro-trial/node_modules/` are for study reference only and will be deleted with this branch after the report is reviewed.
