# TipTap Simple Template — Capability Audit Report

**Session:** Phase 0 — Finalize TipTap foundation before Yjs migration  
**Date:** 2026-05-09  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Simple Template source:** `github.com/ueberdosis/tiptap-ui-components` → `apps/web/src/components/tiptap-templates/simple/`  
**Our editor source:** `artifacts/next-app/src/components/editor/GrapheEditor.tsx` and all files in that directory  
**Branch note:** Named `chore/tiptap-simple-template-audit` — `study/` prefix is not in the repo's hook allow-list; `chore/` is semantically correct for an audit session.

---

## Executive Summary

### Top 5 Must-Haves Before Yjs Migration

**1. `shouldRerenderOnTransaction: false` in `useEditor()`**  
The Simple Template sets `shouldRerenderOnTransaction: false` in its `useEditor()` config, preventing React from re-rendering the editor component on every ProseMirror transaction. We omit this flag entirely. Under normal typing this means one extra React render per keystroke — manageable but wasteful. Under Yjs, every remote peer's keystrokes arrive as individual transactions on the local instance, so without this flag a two-person session would trigger full React re-renders for *every character the other person types*. This is a one-line change with zero behavioral risk and the highest Yjs-readiness return per unit of effort.

**2. Adopt the `ImageUploadNode` block-placeholder pattern (replace blob: URL approach)**  
We currently handle image uploads by inserting a `blob:` URL directly into the TipTap document as a standard image node, then swapping it to the real URL once the upload completes. `blob:` URLs are browser-process-local memory references — they cannot be serialized, cannot round-trip through JSON, and cannot be synced via Yjs's y-prosemirror layer. If a Yjs-enabled session starts while an upload is in-flight, the document state shared with peers contains a `blob:` URL they cannot resolve. The Simple Template's `ImageUploadNode` avoids this entirely: it inserts a dedicated `atom` block node (never an `<img>`) with no src until upload completes, then replaces itself with a real image node. This is the Yjs-correct pattern and also improves UX (progress bars, cancel button, drag-reorderable placeholder).

**3. `SmartTaskItem.appendTransaction` Yjs compatibility guard**  
Our `SmartTaskItem` extension uses `appendTransaction` to auto-sort checked items to the bottom of their list and collapse nested lists when checked. `appendTransaction` is a ProseMirror mechanism that fires on *every* transaction, including remote Yjs transactions. Under concurrent edits this means: User A checks item 2, Yjs delivers the transaction to User B, B's `appendTransaction` fires and sorts — but simultaneously User B is editing item 3, creating a conflicting sort that Yjs cannot resolve cleanly. This is a near-certain conflict amplifier in multi-user sessions. The fix is a single guard condition (`tr.getMeta('y-sync$')`) that skips the sort logic on remote transactions.

**4. Image resize support (drag handles, width attribute)**  
Neither the Simple Template nor our editor has image resize. This becomes urgent pre-Yjs because adding a `width` attribute to the shared schema *after* Yjs ships requires a coordinated schema migration across all connected clients. Adding `width` (integer pixels, JSON-serializable ✓) to the `CustomImage` node before Yjs means zero migration cost. The recommended approach is custom resize handles in `ImageNodeView` — no third-party extension required since we control the NodeView. Session 2 (Pro template study) should evaluate `tiptap-extension-resize-image` as a reference before committing to a build-from-scratch approach.

**5. `Selection` extension for brand-color text selection**  
The Simple Template registers TipTap's `Selection` extension from `@tiptap/extensions`, which applies a CSS class (`ProseMirror-selectedtext`) to the current text selection range. This allows the editor stylesheet to override the browser's default blue selection highlight with the app's brand color. We don't have this. Selected text in Graphe Notes shows the OS/browser selection color (system blue on macOS, grey in some contexts), which clashes with our dark editor theme. This is a zero-risk, zero-Yjs-impact, single-line extension addition that noticeably improves the editor's perceived quality.

---

### Top 5 Should-Haves Before Yjs Migration

**1. `SmartTaskItem` auto-sort Yjs guard (the actual fix, not just the audit)**  
Following from must-have #3: once the conflict risk is confirmed, the one-line fix (`if (transactions.some(tr => tr.getMeta('y-sync$'))) return null;` at the top of appendTransaction) should ship before Phase 1 begins. It is trivial to add and eliminates the most concrete concurrent-edit conflict vector in our schema.

**2. `enableClickSelection: true` in Link config**  
We configure `Link` with `openOnClick: false` but omit `enableClickSelection: true`. The result: clicking a link moves the cursor into the linked text without selecting it, so the link edit popover has no trigger event. With `enableClickSelection: true`, a click selects the full link mark and `editor.isActive('link')` becomes true — enabling the popover to appear. This is how Notion, Linear, and the Simple Template handle link editing. It's a one-line config change.

**3. Per-image alignment attribute on `CustomImage`**  
Currently image alignment is only possible by changing the text-align of the surrounding paragraph, which affects all content in that paragraph. Per-image alignment (left/center/right) requires an `align` attribute on the `CustomImage` node translated to a CSS class or inline style in `ImageNodeView`. Low complexity, improves layout expressiveness, schema change is easier pre-Yjs.

**4. Code block language selector + copy button**  
We have `CodeBlockLowlight` with syntax highlighting but no UI for selecting the language of a block after insertion, and no copy-to-clipboard button. These are table-stakes affordances in modern editors (Notion, Linear, GitHub, VS Code). A language selector in the block's top-right corner (small dropdown, bound to `node.attrs.language`) and a copy button are worth building before Yjs because the NodeView change is straightforward and the language attribute is already a string primitive.

**5. `autocapitalize: "off"` in `editorProps.attributes`**  
The Simple Template sets this. We have `autocomplete: "off"` and `autocorrect: "off"` but not `autocapitalize`. On iOS, the soft keyboard capitalizes the first letter after any editor focus event, treating it as the start of a sentence. This is a one-line fix that eliminates spurious auto-capitalization mid-note.

---

## Gap-by-Gap Detail

---

### Gap 1: Slash Menu UX

**What Simple Template does:**  
Nothing. The Simple Template has no slash command menu. Block type changes happen only via the fixed toolbar.

**What we do:**  
Full custom `SlashCommandExtension` (ProseMirror Plugin + `PluginKey`) + `SlashCommandMenu` (React floating menu, `AnimatePresence` exit animation, keyboard navigation with scroll-into-view, click-outside dismiss). 17 commands covering all content types including math, video, and toggle blocks. The plugin detects `/(query)` in an empty selection, maintains query state, and fires a single-transaction `chain().deleteRange().insertContent()` per command — the entire slash action is one undo step.

**Delta:**  
We significantly exceed the Simple Template. One gap: the Video slash command uses `window.prompt()` to collect the YouTube/Vimeo URL — a blocking native dialog that breaks the editor's React animation layer on some platforms and cannot be styled to match the design system.

**Yjs forward-compat:**  
SlashCommandExtension state is view-local (PluginKey). ✓ Command executions produce standard ProseMirror transactions. ✓ Fully Yjs-safe.

**Priority:** nice-to-have-anytime (replace `window.prompt()` for Video URL)  
**Effort:** Low

**Recommended approach:** Replace the `window.prompt()` in `SlashCommandMenu.tsx`'s Video command with an inline input row that appears within the slash menu when Video is selected. Parse the URL on Enter, call `parseVideoUrl`, insert on match or show an inline error on mismatch. No extension changes required.

---

### Gap 2: Drag Handles and Block Reordering

**What Simple Template does:**  
Nothing. No drag handles, no block reordering. The Simple Template is a fixed-toolbar-only editor with no per-block grip.

**What we do:**  
`SwipeIndentExtension` — touch swipe right to indent, swipe left to outdent for list items. No desktop block drag handle.

**Delta:**  
Neither template has desktop per-block drag handles. Our SwipeIndentExtension is a mobile-specific addition the Simple Template lacks entirely. Desktop reordering is a gap in both. TipTap Pro's `@tiptap/extension-drag-handle` is the canonical solution — evaluate in Session 2.

**Yjs forward-compat:**  
Drag handle operations produce standard `tr.delete / tr.insert` transactions. ✓ Yjs-safe.

**Priority:** nice-to-have-anytime  
**Effort:** High

**Recommended approach:** Defer to Session 2 (Pro template study). If TipTap Pro is adopted, the drag handle comes with it. Don't invest in a custom implementation before that evaluation.

---

### Gap 3: Block-Level Controls (+ Hover Row)

**What Simple Template does:**  
Nothing. No per-block `+` button or Notion-style hover controls.

**What we do:**  
Nothing.

**Delta:**  
Equivalent. Neither implements a block hover row.

**Yjs forward-compat:** N/A

**Priority:** skip  
**Effort:** High

**Recommended approach:** If drag handles are adopted (Gap 2), the `+` insert button typically comes alongside them. Revisit as a bundled feature.

---

### Gap 4: Floating Toolbar / Bubble Menu

**What Simple Template does:**  
Fixed top toolbar only (`<Toolbar>` component, always visible). On mobile, the toolbar uses a contextual sub-view pattern: tapping the highlighter button flips the entire toolbar to a focused `ColorHighlightPopoverContent` view; tapping the link button flips to `LinkContent`. A back arrow returns to the main toolbar. Mobile positioning: `bottom: calc(100% - ${height - rect.y}px)` where `height = window.innerHeight` and `rect` is the body's bounding rect. No TipTap `BubbleMenu`.

**What we do:**  
Fixed top toolbar (desktop/tablet) + fixed bottom toolbar on mobile positioned above the keyboard via `keyboardHeight`. `ScrollableToolbar` wraps mobile toolbar content in horizontal scroll. `AiSelectionMenu` (desktop) and `MobileSelectionMenu` (mobile) are custom floating menus on text selection for AI actions — more selection-triggered UI than the Simple Template, just not the standard formatting bubble menu.

**Delta:**  
Simple Template's mobile sub-view flip is elegant for narrow viewports where horizontal scroll creates discoverability problems. Our `ScrollableToolbar` scroll is functional but buries less-used controls. Neither approach is strictly superior; the sub-view pattern trades quick access to all controls simultaneously for zero scroll. Simple Template's keyboard-offset formula using `window.scrollTo` is wrong for our fixed-chrome layout and should not be adopted.

**Yjs forward-compat:**  
All toolbar interactions produce standard TipTap commands. ✓ Yjs-safe.

**Priority:** nice-to-have-anytime  
**Effort:** Medium

**Recommended approach:** Keep the current mobile bottom toolbar. If usability testing surfaces scroll discoverability as a real pain point, adopt the sub-view pattern for the two highest-frequency overflow controls (color picker, link). Don't adopt it wholesale — we have far more controls than the Simple Template and the back-arrow flow adds cognitive overhead at our feature density.

---

### Gap 5: Image Handling

**What Simple Template does:**  
- **Insertion:** `ImageUploadNode` extension — a block-level `atom: true, draggable: true, selectable: true` node. Renders a file picker UI with progress bars and cancel buttons. On upload success, replaces itself with a standard `Image` node containing the real URL. `blob:` URLs never enter the document.
- **Resize:** None.
- **Alignment:** TextAlign on paragraph/heading. No per-image alignment control.
- **Display:** Bare `@tiptap/extension-image` with SCSS only. No React NodeView.

**What we do:**  
- **Insertion:** Blob: URL → real URL swap. We insert `<img src="blob:...">` or an SVG placeholder immediately into the document as a `CustomImage` node, dispatch a `setNodeMarkup` transaction to swap to the signed URL on upload completion. Blob: URLs are stripped by regex from `onContentChange` before persisting to DB.
- **Resize:** None. Images render at 100% of the prose column width with no resize controls.
- **Alignment:** TextAlign on surrounding paragraph only.
- **Display:** `CustomImage` with React `ImageNodeView` — selection ring, floating edit toolbar (alt text, open, copy URL, download, delete), animated GIF support via `next/image unoptimized`, Supabase vs. external source detection.

**Delta:**  
Two distinct deltas:
1. **Upload placeholder pattern (Yjs-critical):** The blob: URL approach is incompatible with Yjs. The `ImageUploadNode` pattern is Yjs-correct and improves UX.
2. **Image resize:** Gap in both. Must be a dedicated PR. Adding the `width` attribute before Yjs means no schema migration later.

**Yjs forward-compat:**  
🔴 **Red flag:** `blob:` URLs in the document are Yjs-incompatible. y-prosemirror serializes the document to JSON and broadcasts it to peers. Peers receive `"src": "blob:http://..."` — a URL that references our browser's local memory and resolves to nothing on their machine. Additionally, if the document is persisted via a y-leveldb or y-supabase provider while an upload is in-flight, the persisted document contains a dead reference.

The `ImageUploadNode` pattern fixes this: the upload placeholder node has no `src` attribute. It renders entirely via local React state in the NodeView. The node only becomes a `CustomImage` (with a real, permanent URL) after the upload completes.

All `CustomImage` non-upload attributes (`masterPath`, `attachmentId`, `downloadUrl`, `isAnimated`) are string or boolean primitives. ✓ Safe.

**Priority:**  
- ImageUploadNode pattern adoption: **must-have-before-Yjs**  
- Image resize: **should-have-before-Yjs** (schema change easier pre-Yjs)

**Effort:**  
- ImageUploadNode: Medium  
- Image resize: High

**Recommended approach:**  
Replace the current blob: URL upload flow in `GrapheEditor.tsx` with an `ImageUploadNode` approach:
1. Add an `ImageUploadNode` extension: `atom` block node, options for `upload` callback, `accept`, `maxSize`.
2. Its React NodeView shows a progress bar using the existing `onAttachFile` callback pattern.
3. On upload success, the NodeView dispatches `setNodeMarkup` to replace itself with a `CustomImage` node at the real URL.
4. The `handleAttachFile` logic in `GrapheEditor.tsx` moves into the extension's `handleDrop`/`handlePaste` hooks.
5. Remove the blob: URL strip regex from `onUpdate` (no longer needed).

For image resize: add `width` (integer px or null = full-width) to `CustomImage.addAttributes()`. In `ImageNodeView`, render resize handles (bottom-right corner) on selection, using `onPointerDown` + `pointermove` to track delta and dispatch `updateAttributes({ width: newWidth })`.

---

### Gap 6: Link Handling

**What Simple Template does:**  
`StarterKit.configure({ link: { openOnClick: false, enableClickSelection: true } })`. A `LinkPopover` component opens a URL input/edit popover when the link toolbar button is clicked or when a link is active in the selection. On mobile, the toolbar flips to a `LinkContent` sub-view. The `@tiptap/extension-link` paste handler auto-converts pasted URLs to links.

**What we do:**  
`Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } })` — missing `enableClickSelection: true`. `LinkPopover.tsx` exists in the toolbar. Without `enableClickSelection: true`, clicking a link moves the cursor into the linked text but doesn't select it, so `editor.isActive('link')` doesn't become true and the link popover has no automatic trigger.

**Delta:**  
Missing `enableClickSelection: true`. One config key.

**Yjs forward-compat:**  
Config-only change. ✓ No flags.

**Priority:** should-have-before-Yjs  
**Effort:** Low

**Recommended approach:**  
In `GrapheEditor.tsx`, add `enableClickSelection: true` to `Link.configure(...)`. Verify that `LinkPopover.tsx` uses `editor.isActive('link')` to auto-show when a link is selected — if it only opens on explicit toolbar click, update it to respond to `selectionUpdate` events as well.

---

### Gap 7: Tables

**What Simple Template does:**  
Nothing. No table extension.

**What we do:**  
Full `@tiptap/extension-table` with `TableRow`, `TableHeader`, `TableCell`, `resizable: true`. Insertable via slash command (3×3 with header row).

**Delta:**  
We significantly exceed the Simple Template.

**Yjs forward-compat:**  
Table column widths are stored as integer attributes — JSON-primitive-safe ✓. The `columnResizing` plugin is view-local and doesn't write to the document. ✓ Safe. Verify during Phase 1 that concurrent column-resize operations merge correctly.

**Priority:** skip (we're ahead)  
**Effort:** N/A

---

### Gap 8: Code Blocks

**What Simple Template does:**  
StarterKit default `CodeBlock`. No language selector, no syntax highlighting, no copy button, no line numbers.

**What we do:**  
`CodeBlockLowlight` with `lowlight` using the `common` language bundle (~30 languages). Rich syntax highlighting. No language selector UI, no copy button, no line numbers. Language is set at block creation (slash command always creates an un-languaged block) and cannot be changed through the UI.

**Delta:**  
We have syntax highlighting; they don't. We both lack: (a) language selector after insertion, (b) copy-to-clipboard button in the block chrome. These are expected affordances in modern editors.

**Yjs forward-compat:**  
`language` attribute is a string primitive. ✓ Safe.

**Priority:** nice-to-have-anytime  
**Effort:** Medium

**Recommended approach:**  
Extend `CodeBlockLowlight` with a React NodeView that renders a language `<select>` (or shadcn `DropdownMenu`) and copy button in the top-right corner of the block. Bind the selector to `node.attrs.language` via `updateAttributes`. The NodeView can be scoped to just the "chrome" — keep the existing `<pre>` rendering unchanged.

---

### Gap 9: Lists

**What Simple Template does:**  
Standard `TaskList` + `TaskItem.configure({ nested: true })`. Standard `bulletList` and `orderedList` via StarterKit. Default `Tab`/`Shift+Tab` indent/outdent. No exit-on-empty behavior beyond StarterKit defaults.

**What we do:**  
`SmartTaskItem` (extends TaskItem) — auto-sort (checked items move to bottom), collapse-on-check, parent-uncheck cascade. `SwipeIndentExtension` — touch swipe indent/outdent. `ListExitOnEnterExtension` — Enter in an empty list item lifts it out of the list. Significantly ahead in list UX.

**Delta:**  
We exceed the Simple Template. The only concern is `SmartTaskItem.appendTransaction` Yjs compat (see below).

**Yjs forward-compat:**  
🔴 **Red flag:** `SmartTaskItem.appendTransaction` auto-sorts checked items. This fires on *every* transaction including remote Yjs transactions. When a remote peer checks a task item, our local `appendTransaction` fires and sorts — while the remote peer's may sort differently — producing a conflict.

Fix before Phase 1: add at the top of `appendTransaction`:
```ts
if (transactions.some(tr => tr.getMeta('y-sync$'))) return null;
```
y-prosemirror sets the `'y-sync$'` meta key on all remote transactions. This guard makes the sort run only on local user actions.

`SmartTaskItem`'s `collapsed` attribute is a boolean primitive. ✓ Safe.

**Priority:** should-have-before-Yjs (one-line Yjs guard in SmartTaskItem.ts)  
**Effort:** Low

**Recommended approach:**  
Add the `y-sync$` meta guard to the top of `appendTransaction` in `SmartTaskItem.ts`. Ship as `fix/smart-task-item-yjs-compat`.

---

### Gap 10: Headings

**What Simple Template does:**  
StarterKit headings h1–h4. `HeadingDropdownMenu` in toolbar. No outline/anchor links. Markdown shortcuts via StarterKit inputRules.

**What we do:**  
StarterKit headings h1–h3 (h4 excluded by design). Slash commands for h1–h3. `TableOfContents.tsx` as document outline (toolbar-accessible). Markdown shortcuts.

**Delta:**  
We support h3 only vs h4 in the Simple Template. Our design system deliberately limits to three heading levels for note-taking. `TableOfContents` is a meaningful addition they lack. No action needed.

**Yjs forward-compat:**  
Heading level is an integer attribute. ✓ Safe.

**Priority:** skip  
**Effort:** N/A

---

### Gap 11: Keyboard Shortcuts

**What Simple Template does:**  
StarterKit built-in shortcuts only. No custom shortcuts. A `formatShortcutKey` / `parseShortcutKeys` utility in `tiptap-utils.ts` is prepared for rendering shortcut hints in tooltips, but the Simple Template doesn't actually use it in its toolbar.

**What we do:**  
StarterKit built-ins + custom: `Cmd+F` / `Cmd+H` → find/replace panel. `ListExitOnEnterExtension` binds `Enter` (priority 200). `SwipeIndentExtension` handles touch. No shortcut hints in toolbar tooltips.

**Key StarterKit shortcuts present in both:**  
`Cmd+B` bold, `Cmd+I` italic, `Cmd+U` underline, `Cmd+Shift+X` strikethrough, `` Cmd+` `` inline code, `Cmd+Shift+B` blockquote, `Cmd+Z` undo, `Cmd+Shift+Z` redo, `Tab`/`Shift+Tab` list indent/outdent. Markdown input rules: `**text**`, `_text_`, `# `, `> `, `` ` ``.

**Delta:**  
Neither template displays keyboard shortcut hints in toolbar button tooltips. This is a common convention that reduces discoverability friction.

**Yjs forward-compat:**  
All keyboard shortcuts produce standard TipTap commands. ✓ Yjs-safe.

**Priority:** nice-to-have-anytime  
**Effort:** Low

**Recommended approach:**  
Add shortcut hint strings to toolbar buttons in `EditorToolbar.tsx` — either as `title` attributes or wrapped in shadcn `Tooltip`. Port the `formatShortcutKey` pattern from the Simple Template's `tiptap-utils.ts` to render Mac/Windows symbols appropriately.

---

### Gap 12: Selection and Cursor Behavior

**What Simple Template does:**  
Registers `Selection` from `@tiptap/extensions` — a lightweight extension that applies the CSS class `ProseMirror-selectedtext` to the text selection decoration range. The editor's stylesheet can then style `.ProseMirror-selectedtext { background: <brand-color>; }` to override the browser's OS selection color.

**What we do:**  
No `Selection` extension. Browser default OS selection colors apply everywhere — system blue on macOS, grey on some platforms. No brand-colored selection highlight in the editor.

**Delta:**  
Missing branded selection color. Selected text doesn't look like it belongs to the Graphe design system.

**Yjs forward-compat:**  
`Selection` is a decoration-only extension (no schema changes). ✓ Fully Yjs-safe. y-prosemirror has its own remote-cursor decoration system; `Selection` applies only to local selection and does not conflict.

**Priority:** should-have-before-Yjs  
**Effort:** Low

**Recommended approach:**  
1. Check if `@tiptap/extensions` is already in `artifacts/next-app/package.json`. If not, install it.
2. Add `Selection` to the extensions array in `GrapheEditor.tsx`.
3. Add CSS in `globals.css` targeting `.ProseMirror-selectedtext` using the `primary` accent color at reduced opacity (e.g., `background: hsl(var(--primary) / 0.25); border-radius: 2px;`).

---

### Gap 13: Undo / Redo

**What Simple Template does:**  
TipTap default undo/redo via StarterKit's bundled `history` plugin. `UndoRedoButton` components in the toolbar. No custom history configuration.

**What we do:**  
Same: TipTap default `history` plugin. `showUndoRedo` prop on `EditorToolbar`. Known issue: undo behaves incorrectly in some edge cases (believed to be related to our `setTimeout(setContent, 0)` imperative content reset with `emitUpdate: false`, which can create spurious history entries on note switch).

**Delta:**  
Both use the same default history. Our known undo bug is a pre-existing issue. Critically, **Yjs replaces ProseMirror's history plugin entirely** — y-prosemirror's `UndoManager` is the undo implementation under collaboration. Any history workaround built now gets thrown out in Phase 1.

**Yjs forward-compat:**  
Phase 1 replaces the history plugin with `UndoManager`. Observation only — no action for this session.

**Priority:** skip (Yjs Phase 1 owns undo/redo entirely)  
**Effort:** N/A

---

### Gap 14: Copy / Paste Behavior

**What Simple Template does:**  
Default TipTap paste handling. HTML pastes: TipTap's built-in HTML parser. Plain text: inserted as paragraph text. Image pastes: handled inside `ImageUploadNode` extension's `handlePaste` prop (intercepts `image/*` MIME types, creates an `imageUpload` node, runs the upload flow). No global `document.addEventListener('paste')` listener.

**What we do:**  
Custom `document.addEventListener('paste', onPaste)` that intercepts image MIME types when `editor.isFocused`. The handler creates a blob: URL placeholder, inserts it as a `CustomImage` node, calls `onAttachFile`, then swaps to the real URL. HTML/Markdown paste uses TipTap defaults.

**Delta:**  
Our image paste is tightly coupled to the blob: URL approach. When `ImageUploadNode` is adopted (Gap 5), the paste handler moves into the extension's `handlePaste` prop — the pattern is cleaner and scoped to the editor's `EditorView` rather than the global `document`. The global listener has a subtle risk: multiple components registering `paste` on `document` can race. Note: drag-drop image files are not handled by either template's paste listener (drops fall through to the browser's default behavior — an additional implementation needed when adopting ImageUploadNode).

**Yjs forward-compat:**  
The global paste listener is not Yjs-aware but doesn't interact with Yjs state. No direct Yjs conflict. The blob: URL it inserts is Yjs-incompatible (subsumed by Gap 5).

**Priority:** depends on ImageUploadNode adoption (Gap 5)  
**Effort:** subsumed by Gap 5

**Recommended approach:**  
When implementing `ImageUploadNode` (Gap 5), move the image paste intercept into the extension's `handlePaste` prop. Remove the global `document.addEventListener('paste')` handler from `GrapheEditor.tsx`. Also add `handleDrop` to handle drag-dropped image files. Add `autocapitalize: "off"` to `editorProps.attributes` as a standalone fix in the meantime.

---

### Gap 15: Mobile Interactions

**What Simple Template does:**  
- `useIsMobile()` hook (< 768px breakpoint).
- Toolbar contextual sub-views (highlighter / link) on mobile.
- `useCursorVisibility` hook: on `selectionUpdate`, compares `window.innerHeight < body.height`; if the cursor's `coordsAtPos(from).top` is too close to the overlay, scrolls `window` up via `window.scrollTo({ top: ..., behavior: 'smooth' })`.
- `editorProps.attributes`: includes `autocapitalize: "off"`.
- No mobile context menu suppression. No Android keyboard-dismiss detection.

**What we do:**  
- `useBreakpoint()` returning `mobile | tablet | desktop`.
- `ScrollableToolbar` horizontal scroll on mobile.
- Custom `ensureCursorVisible`: fires on `selectionUpdate` + `update`, walks the DOM up to the nearest `overflow: auto/scroll` scroll container, calls `el.scrollBy({ top: delta, behavior: 'instant' })`.
- Mobile native context menu suppression (`contextmenu` preventDefault) — prevents OS menu from covering `MobileSelectionMenu`.
- Android keyboard-dismiss detection via `keyboardHeight` transition from > 0 to 0, triggering `active.blur()`.
- `editorProps.attributes`: `autocomplete: "off"`, `autocorrect: "off"`, `spellcheck: "true"`. Missing `autocapitalize: "off"`.

**Delta:**  
Our mobile handling is substantially more thorough. The Simple Template's `window.scrollTo` cursor visibility approach is *wrong* for our fixed-chrome layout — our content is inside a scroll container, not the page body. Our container-walking `scrollBy` is correct. The only actionable gap is `autocapitalize: "off"`.

**Yjs forward-compat:**  
All mobile handling is view-local. ✓ No flags.

**Priority:** nice-to-have-anytime (autocapitalize only — the rest we already exceed)  
**Effort:** Low (single attribute in editorProps)

**Recommended approach:**  
Add `autocapitalize: "off"` to the `editorProps.attributes` object in `GrapheEditor.tsx`. Bundle with any nearby PR rather than opening a dedicated branch.

---

### Gap 16: Performance Patterns

**What Simple Template does:**  
- `shouldRerenderOnTransaction: false` — prevents React re-renders on every ProseMirror transaction.
- `immediatelyRender: false` — no SSR/hydration flash.
- Extensions defined inline in `useEditor()` (no explicit memoization, but `shouldRerenderOnTransaction: false` makes this less costly since the component rarely re-renders).

**What we do:**  
- `immediatelyRender: false` ✓
- Extensions via `useMemo([], [])` ✓ (guarantees stable array reference — actually stricter than the Simple Template)
- **Missing `shouldRerenderOnTransaction: false`**

**Delta:**  
Our `useMemo` extension array is the better pattern. The gap is the missing `shouldRerenderOnTransaction: false`. Without it, every ProseMirror transaction (every keystroke, selection change, undo) causes a React re-render of `GrapheEditor` and all its children. For Yjs this is a performance cliff: every remote peer's keystroke triggers a local React re-render cascade.

**Yjs forward-compat:**  
🔴 **Critical:** Yjs fires a ProseMirror transaction per character received from a remote peer. Without `shouldRerenderOnTransaction: false`, a co-editing session with fast typists would generate dozens of React re-renders per second. This will be immediately noticeable as jank.

Note: after setting this flag, verify that all toolbar button active states and word count UI derive their state from `editor.on('update', ...)` / `editor.on('selectionUpdate', ...)` event subscriptions rather than from React render cycles. The `EditorToolbar` receives `editor` as a prop and reads `editor.isActive(...)` — this must continue to work. Likely needs `editor.on('selectionUpdate', forceUpdate)` in toolbar components.

**Priority:** **must-have-before-Yjs**  
**Effort:** Low (one-line config; follow-up check of toolbar state subscriptions)

**Recommended approach:**  
Add `shouldRerenderOnTransaction: false` to `useEditor()` in `GrapheEditor.tsx`. Audit all child components that read editor state (`EditorToolbar`, `AiSelectionMenu`, `MobileSelectionMenu`, `WordCountPopover`, `FindReplacePanel`, `TableOfContents`) to ensure they subscribe to editor events rather than relying on parent re-renders.

---

### Gap 17: Empty State and Placeholder Handling

**What Simple Template does:**  
No `Placeholder` extension. The editor starts with pre-seeded demo content from `content.json`. No empty-state UI.

**What we do:**  
`Placeholder.configure({ placeholder })` — shows a localized placeholder string passed as prop (default `"Start writing..."`). `EmptyEditorState.tsx` provides additional empty-state onboarding UI.

**Delta:**  
We significantly exceed the Simple Template. No action needed.

**Yjs forward-compat:**  
`Placeholder` is a decoration-only extension. ✓ Fully Yjs-safe.

**Priority:** skip (we're ahead)  
**Effort:** N/A

---

### Gap 18: Additional Findings

**What Simple Template does (notable extras not covered above):**

1. **`EditorContext.Provider` wrapper** — TipTap's React context exposes the `editor` instance to all descendants without prop-drilling. Toolbar sub-components call `useCurrentEditor()` to access the editor. Our architecture passes `editor` as an explicit prop through `GrapheEditor` → `EditorToolbar` → child components.

2. **`@tiptap/extension-list` meta-package** — Simple Template imports `TaskItem` / `TaskList` from `@tiptap/extension-list` (a new TipTap v3 package consolidating all list types). We import from the legacy separate packages (`@tiptap/extension-task-item`, `@tiptap/extension-task-list`). No functional difference today, but the separate packages may be deprecated in future TipTap v3 minor versions.

3. **`ImageUploadNode` is `atom: true, draggable: true, selectable: true`** — The `atom` flag means ProseMirror cannot place the cursor inside the node; it is selected as a unit. This prevents accidental focus interruption of the upload UI and makes the placeholder drag-reorderable as a block. Correct design for any block-level loading state.

4. **AbortController pattern for upload cancellation** — The `ImageUploadNode` component holds an `AbortController` per file, passed to the `upload` function as an `AbortSignal`. The cancel button calls `.abort()`. Our current approach has no upload cancellation path.

5. **`use-menu-navigation.ts` hook** — Extracted keyboard navigation hook (arrow keys, enter, escape) used in menu components. Our `SlashCommandMenu` implements equivalent logic inline; extraction would improve reusability if a second custom menu is added.

**Yjs forward-compat:**  
`EditorContext.Provider` and `useCurrentEditor()` are React-layer only. ✓ No flags. Package import changes are import-level only. ✓ No flags.

**Priority:** nice-to-have-anytime for all five  
**Effort:** Low–Medium each

**Recommended approach:**  
- `EditorContext.Provider`: Low-priority refactor. Would clean up prop threading through `NoteShell` → `GrapheEditor`. Defer until a dedicated component refactor session.  
- `@tiptap/extension-list` consolidation: Trivial import swap — bundle into a nearby chore PR.  
- AbortController: Add when adopting `ImageUploadNode` (Gap 5).  
- `use-menu-navigation.ts`: Evaluate extraction only if a second custom keyboard-navigable menu is added. Not worth extracting for one consumer (`SlashCommandMenu`).

---

## Triaged Backlog

Sorted by priority (must-have → should-have → nice-to-have) then effort (Low → Medium → High).

| Item | Priority | Effort | Yjs notes | Suggested branch |
|---|---|---|---|---|
| `shouldRerenderOnTransaction: false` in `useEditor()` | must-have-before-Yjs | Low | Yjs fires many transactions/sec; without this flag remote typing causes React re-render storms | `fix/editor-rerender-optimization` |
| `SmartTaskItem.appendTransaction` Yjs guard (`y-sync$` check) | must-have-before-Yjs | Low | appendTransaction fires on remote transactions → concurrent sort conflicts | `fix/smart-task-item-yjs-compat` |
| Adopt `ImageUploadNode` block-placeholder (no blob: URLs in doc) | must-have-before-Yjs | Medium | blob: URLs are non-serializable and cannot sync via y-prosemirror | `feat/image-upload-node` |
| `Selection` extension (brand-color text selection) | should-have-before-Yjs | Low | CSS-only decoration, zero Yjs impact | `fix/editor-selection-extension` |
| `enableClickSelection: true` in Link config | should-have-before-Yjs | Low | Config-only, no Yjs impact | `fix/link-click-selection` |
| Image resize (drag handles, `width` attribute) | should-have-before-Yjs | High | Width is a primitive int ✓; adding post-Yjs requires schema migration | `feat/image-resize` |
| `autocapitalize: "off"` in `editorProps.attributes` | nice-to-have-anytime | Low | No Yjs impact | bundle into any nearby PR |
| Replace `window.prompt()` in slash command Video action | nice-to-have-anytime | Low | No Yjs impact | `fix/slash-video-modal` |
| Keyboard shortcut hints in toolbar tooltips | nice-to-have-anytime | Low | No Yjs impact | `feat/toolbar-shortcut-hints` |
| `@tiptap/extension-list` package consolidation | nice-to-have-anytime | Low | No impact | bundle into a chore PR |
| Code block language selector + copy button | nice-to-have-anytime | Medium | Language attr is a string primitive ✓ | `feat/code-block-ux` |
| Mobile toolbar contextual sub-views | nice-to-have-anytime | Medium | No Yjs impact | `refactor/mobile-toolbar-subviews` |
| `EditorContext.Provider` refactor | nice-to-have-anytime | Medium | No Yjs impact | `refactor/editor-context-provider` |
| Desktop block drag handle | nice-to-have-anytime | High | View-only ✓; evaluate TipTap Pro in Session 2 first | `feat/block-drag-handle` |

---

## Patterns We Should NOT Adopt

**1. CSS-in-SCSS approach**  
The Simple Template uses `.scss` files for every node component and a master `simple-editor.scss`. Our Tailwind CSS v4 + `globals.css` approach is intentional. Adopting SCSS would fragment styling between two systems and bypass our design token layer (`--foreground`, `--primary`, `--panel-border`, etc.). All node-level styling stays in Tailwind classes or `globals.css` CSS variables.

**2. Simple Template's binary dark mode toggle**  
The Simple Template has a `ThemeToggle` component that swaps a `data-theme` attribute. Our Atmosphere System (`data-dark-level = soft | default | oled`, `data-colorblind = none | protanopia | tritanopia`) is significantly more sophisticated and maps to genuine accessibility and user preference needs. Don't reduce it to a binary toggle.

**3. `window.scrollTo` for cursor visibility**  
The Simple Template's `useCursorVisibility` hook scrolls the page body to bring the cursor above the keyboard. Our layout has a fixed chrome (sidebar + note panel + fixed toolbar) where the scrollable region is an inner container, not the page body. `window.scrollTo` does nothing for content inside a scroll container. Our container-walking `scrollBy` approach is correct for our layout and should be kept.

**4. Inline extensions without `useMemo`**  
The Simple Template defines extensions inline in `useEditor()` without explicit memoization. This would cause TipTap to call `setOptions()` and compare the extension array on every render cycle where the component re-renders. Our `useMemo([], [])` approach is stricter and prevents unnecessary option comparisons. Don't regress to inline definitions even though `shouldRerenderOnTransaction: false` partially mitigates the cost.

**5. Omitting the `Placeholder` extension**  
The Simple Template ships with pre-seeded demo content and no placeholder. Our placeholder UX (configurable string, passed as prop) is intentional and important for blank-state onboarding in a real notes application. Keep it.

**6. Vite + vanilla React module assumptions**  
The Simple Template is a Vite demo app, not Next.js App Router. Don't align bundle config, SSR assumptions, `"use client"` patterns, or path alias conventions to the Simple Template's setup. Our `@/*` → `./src/*` and `@lib/*` → `../../lib/*` aliases are correct for our monorepo.

---

## Surprises and Clever Bits

**`shouldRerenderOnTransaction: false` is not prominently documented.**  
It's easy to miss — TipTap's README and quickstart don't mention it. The Simple Template is the first official reference that shows it as canonical. Without it, complex editors with many stateful toolbar buttons re-render heavily on every keystroke. This flag makes TipTap behave like a controlled component only on explicit parent state changes rather than on every document mutation. For our editor (which has ~30 toolbar buttons that read `editor.isActive()`), this flag is not just a nice-to-have — it's architecturally necessary at Yjs transaction volumes.

**`ImageUploadNode` is `atom: true` and `draggable: true` simultaneously.**  
An `atom` node cannot have its interior focused (cursor cannot enter it) but can be selected as a unit and drag-reordered. This means the upload progress UI is never accidentally interrupted by the user clicking inside it. The `atom + draggable + selectable` combination is the correct triad for any block-level placeholder or loading state node — a pattern applicable to video embed and other "loading" states we may add later.

**The Simple Template's mobile sub-view toolbar is pure React state — no extension involved.**  
`mobileView: "main" | "highlighter" | "link"` is component state in `SimpleEditor`. Switching views just conditionally renders different toolbar JSX. No TipTap extension API is needed for toolbar layout changes. This is cleaner than one might expect — toolbar *layout* is a UI concern separate from the editor's document model.

**`Selection` extension lives in `@tiptap/extensions` (the catch-all package), not in its own package.**  
`@tiptap/extensions` bundles smaller standalone extensions that don't warrant a dedicated package. We need to verify whether this package is already installed before adding it: `grep "@tiptap/extensions" artifacts/next-app/package.json`.

**`enableClickSelection: true` is a Link extension option, not a separate extension.**  
Since we configure `Link` separately (not via StarterKit's bundled link config), we set it on our explicit `Link.configure({ openOnClick: false, enableClickSelection: true, HTMLAttributes: {...} })`. One key, one PR.

**The Simple Template does not handle drag-and-drop image files.**  
Dragging an image file onto the Simple Template's editor falls through to the browser's default behavior (navigating to the file). `ImageUploadNode` would need a `handleDrop` implementation to intercept file drops. This is a gap in their template and something we'd need to build when adopting the pattern — our current `document.addEventListener('paste')` handler doesn't cover drops either.

**We are ahead of the Simple Template in 12 of 18 capability areas.**  
The Simple Template is a minimal starting point. Our editor has significantly more feature depth. The most actionable findings from this audit are not "things the Simple Template has that we lack" but rather "patterns the Simple Template uses correctly that we got slightly wrong" — specifically the Yjs-critical `shouldRerenderOnTransaction: false` flag, the blob: URL document pollution, and the `SmartTaskItem.appendTransaction` Yjs conflict vector. These three issues are the entirety of our Yjs-blocking technical debt in the editor layer.
