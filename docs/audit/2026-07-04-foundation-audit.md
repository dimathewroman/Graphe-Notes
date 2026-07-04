# Graphe Notes — Foundation Audit (Stage 1)

**Date:** 2026-07-04 · **Branch audited:** `master` (via `chore/full-audit`, clean tree) · **Scope:** read-only code audit; app not run.
**Method:** eight audit passes — six parallel (mobile readiness, design/UI, efficiency, security, dead code/duplication, architecture & docs drift) plus a second wave of two dedicated AI passes (architecture/plumbing vs the locked AI Provider Architecture v2 spec; prompt quality & AI UX) — with the load-bearing file:line claims independently re-verified against source before inclusion.

**Grounding in the roadmap:** this audit is written against the locked Templates v2 era decisions (Notion: *Templates v2 Era — Foundation Architecture*, May 2026): **Capacitor** is the mobile path, **Yjs** is Phase 1, and a **Foundation Optimization Audit** is already a tracked parallel initiative. Findings are tagged accordingly:
- **[CAP]** — blocks or degrades the Capacitor wrap; must be fixed web-side regardless of plugins
- **[YJS]** — partially or wholly obsoleted by the Yjs Phase 1 migration; weigh effort against that timeline
- **[FOA]** — belongs in the Foundation Optimization Audit workstream

Grading: **Critical / High / Medium / Low**, judged against the stated goal order: (1) mobile-app readiness (iPhone, Android, iPad, foldables), (2) design quality, (3) efficiency, (4) leaner code, (5) trustworthy docs. Security is graded on its own scale and — per SECURITY.md policy — unfixed findings are **not** documented in this file (see §S).

---

## §M. Mobile readiness

The responsive layer is genuinely solid (see clean bills), but the app is **not yet shippable as a mobile app**: three independent blockers (M1–M3), plus a consistent theme of *touch gated on viewport width instead of pointer type* (M4, M5, M10, M11).

### M1. No safe-area handling and no viewport configuration at all — **Critical [CAP]**
`src/app/layout.tsx` has no `viewport` export; repo-wide grep for `safe-area`, `viewport-fit`, `env(safe-area-inset` returns zero hits in `src/`. The mobile editor toolbar is `fixed left-0 right-0` with `bottom: 0` (`components/editor/GrapheEditor.tsx:470-478`). In a Capacitor/WKWebView or PWA-standalone shell, the fixed bottom toolbar sits on the iPhone home indicator, the header collides with the notch, and Android gesture-nav overlaps tap targets. Browser chrome masks this today; a wrapper won't.
*Fix:* `viewport` export with `viewportFit: "cover"`; pad all fixed chrome (header, bottom toolbar, drawers, sheets) with `env(safe-area-inset-*)`.

### M2. Android hardware back / browser back disconnected from navigation — **High [CAP]**
Mobile navigation is pure Zustand (`store.ts` — `mobileView: "list" | "editor"`); the only router usage in the app is `auth/callback/page.tsx`; zero `pushState`/`popstate` anywhere. Back from the editor exits the app (potentially mid-edit) instead of returning to the list; modals, drawers, and the vault screen don't intercept back either.
*Fix:* mirror `mobileView` + open overlays into history entries with a `popstate` handler; in the wrapper, wire Capacitor's `App.backButton` to the same stack.

### M3. No PWA manifest, no service worker, no offline handling of any kind — **High [CAP][YJS]**
`public/` contains only images; no manifest in metadata; no service worker; grep for `navigator.onLine|"offline"` is empty. No install path, no offline shell, and not even an offline toast when a save fails. Yjs Phase 1 (IndexedDB persistence) is the real fix for data; the app shell and a network-status listener still need doing web-side.
*Fix now (cheap):* `online`/`offline` listener + save-failure surfacing. *Fix in Phase 1:* Yjs IndexedDB + manifest/SW (or Capacitor local bundle).

### M4. 44px touch minimum gated on viewport width, not pointer type — iPads get sub-44px targets — **High**
`ui/IconButton.tsx:19` and `editor/ToolbarButton.tsx:28`: `min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0` (verified). Every iPad and Android tablet is ≥768px, so both primitives drop the minimum on exactly the touch devices the app claims to support (~32/28px effective).
*Fix:* gate on pointer, not width — `pointer-coarse:` variant / `@media (pointer: coarse)`.

### M5. Hover-gated actions with no touch path — **High**
- `Sidebar.tsx:240-260` — folder Edit/Add-subfolder buttons `opacity-0 group-hover:opacity-100`, ~26px, no long-press equivalent for folders.
- `editor/TagRow.tsx:46-49` — tag remove is hover-only with a bare 10px icon.
- `AllAttachments.tsx:94-100`, `editor/AttachmentPanel.tsx:82` — download/delete hover-only.
- `VersionHistoryPanel.tsx:295,304` — label edit hover-only (line 342 applies the correct `isMobile` pattern to a *different* button in the same file).
- `editor/VideoEmbed.tsx:85` — remove button is `hidden group-hover:flex`: `display:none`, so **untappable entirely** on touch.
The correct pattern already exists in `NoteList.tsx:945,1000` and `TemplatePickerModal.tsx:609` — it just wasn't applied everywhere.
*Fix:* apply the NoteList pattern (always-visible at reduced opacity + 44px target on touch) to the five surfaces above.

### M6. iOS input auto-zoom: raw inputs under 16px — **Medium**
`editor/TagRow.tsx:65` (12px), `NoteList.tsx:687` (search, 14px), `Sidebar.tsx:295`, `editor/FindReplace.tsx:308,365`. iOS zooms on focus of any input <16px and stays zoomed after blur. The shadcn `ui/input.tsx:11` has the correct `text-base md:text-sm` pattern — but it has **zero importers** (§R2): the kit solved this and nobody uses the kit.
*Fix:* `text-base md:text-sm` on all raw inputs (or actually adopt `ui/input`).

### M7. `h-screen`/`100vh` everywhere; zero `dvh`/`svh` — **Medium**
`Home.tsx:158`, `NoteShell.tsx:791`, `QuickBitShell.tsx:619`, `NoteList.tsx:482`, `QuickBitList.tsx:169`, `RecentlyDeleted.tsx:155`, `AIPanel.tsx:171`, `TemplatePickerModal.tsx:315`. With dynamic URL bars, `100vh` overshoots the visible viewport; bottom-anchored in-flow content can hide behind browser chrome.
*Fix:* `h-dvh` on top-level shells.

### M8. Keyboard avoidance is bespoke and fragile; the flicker fixes aren't on master — **Medium [CAP]**
`hooks/use-mobile.tsx:45-73` (`useKeyboardHeight` — genuinely well-researched visualViewport math) feeds `GrapheEditor.tsx:475` (`bottom: keyboardHeight`), a manual cursor-exposure scroll with hardcoded `TOOLBAR_HEIGHT = 56` (`GrapheEditor.tsx:349-392`), and a keyboard-close blur heuristic (`:405-425`). Four stacked heuristics; `position:fixed` doesn't track the iOS visual viewport during keyboard animation, so the toolbar detaches during open/close. **The recent flicker fixes (`8da7e82`, `c4a1d98`…) live on unmerged `fix/mobile-polish-and-toolbar-bugs` — master has none of them.** In the wrapper, `@capacitor/keyboard` (already in the locked plugin set) replaces most of this.
*Fix:* land the flicker branch; declare `interactive-widget=resizes-content`; measure toolbar height from the DOM.

### M9. No `overscroll-behavior` anywhere — pull-to-refresh can destroy editing state — **Medium**
Zero grep hits for `overscroll` in `src/`. Android pull-to-refresh at the top of the list/editor reloads the SPA, dropping unsaved editor state and all Zustand navigation.
*Fix:* `overscroll-behavior-y: none` on body; `contain` on scrollable panels.

### M10. Panel resize dividers are mouse-only — **Medium**
`ui/ResizeHandle.tsx:15-47`: `onMouseDown` + document `mousemove`/`mouseup` only, 4px-wide handle. iPad Pro landscape (1366px) is `desktop` breakpoint and renders these — inoperable by touch, violating CLAUDE.md's own requirement.
*Fix:* Pointer Events + `setPointerCapture` + `touch-action: none`, wider hit zone on coarse pointers.

### M11. Image resize handles lack `touch-action: none` — **Medium**
`editor/ImageNodeView.tsx:230-235, 346-352` use Pointer Events correctly but without `touch-none`, a touch drag scrolls the editor and fires `pointercancel`, aborting the resize — broken on the primary mobile input.
*Fix:* add `touch-none` to both handles.

### M12. Breakpoints drift from the manifesto and are re-derived ad hoc — **Medium**
`hooks/use-mobile.tsx:3-9`: mobile <768 / tablet 768–1199 / desktop ≥1200; the manifesto says mobile <600, tablet landscape 768–1024, desktop >1024. Code is internally consistent at 768, but 600–767px tablets get the phone layout, 1024–1199 disagrees with spec, `AiSelectionMenu.tsx:97` hardcodes its own `innerWidth < 768`, and foldable inner (700–900 near-square) has no handling.
*Fix:* pick one canonical set, encode in the hook + Tailwind screens, update CLAUDE.md.

### M13. `useBreakpoint` initializes to `"desktop"` — phones flash the desktop layout — **Low**
`use-mobile.tsx:12-24`: `useState("desktop")`, corrected in `useEffect`. First paint on a phone mounts the three-panel desktop tree, then swaps — wasted mount/unmount on the weakest devices; 16 consumers each attach their own resize listener.
*Fix:* initialize from `window.innerWidth` (SSR-guarded) or one shared `matchMedia` store.

### M14. `backdrop-blur` on keyboard-tracking fixed chrome — **Low** *(= §E15)*
### M15. No `-webkit-tap-highlight-color` reset or `touch-action: manipulation` — **Low**
Zero grep hits. Default gray tap flashes on every custom button; double-tap zoom possible on toolbar buttons.
### M16. Native-wrapper couplings: localStorage auth/prefs, browser-redirect OAuth — **Low [CAP]**
`lib/supabase.ts` persists sessions to localStorage (WKWebView can evict it under pressure → logout + pref wipe); OAuth completes via browser redirect (`auth/callback/page.tsx`) and needs deep-link handling in a wrapper. The locked plugin set already anticipates this (`@capacitor/preferences`/secure-storage) — the work is injecting a pluggable storage adapter web-side.

**Clean bills:** complete mobile back-navigation incl. vault-locked notes (`VaultLockScreen.tsx:36`, `NoteHeader.tsx:67`, `QuickBitShell.tsx:627`, `RecentlyDeletedDetail.tsx:188`); unusually well-researched `useKeyboardHeight` math; proper long-press/context-menu duality in both lists (`NoteList.tsx:573-595,719`); `MobileSelectionMenu` positions against `visualViewport` with documented iOS-callout rationale; sidebar is a Vaul drawer on compact viewports; scrollbar styling correctly gated `@media (pointer: fine)`; nothing found that breaks at 344px.

---

## §D. Design & UI

The design *system* is in better shape than the design *implementation*: the token/motion architecture in `globals.css` + `use-motion.ts` is thoughtful and real, but three headline features — colorblind remapping, motion levels in CSS, single-accent discipline — are silently defeated at the component layer. This is ~a week of mechanical cleanup, not a redesign.

### D1. Semantic color tokens bypassed — colorblind system largely defeated — **High**
96 raw palette usages across 15 files (`text-red-500` ×11, `text-emerald-500` ×11, `bg-amber-500` ×11, `text-yellow-500` ×5…) vs `text-destructive` ×28, `text-success` **0**, `text-warning` **0** (verified). The protanopia/tritanopia remaps (`globals.css:631-640`) only touch the semantic tokens — so the flagship colorblind feature works only for destructive labels. Examples: `QuickBitList.tsx:38-48` (expiry urgency), `VaultModal.tsx:122-148`, `QuickBitShell.tsx:647` (save dot), `NoteList.tsx:957,997` (favorite stars).
*Fix:* sweep-replace semantic reds/greens/ambers with `destructive`/`success`/`warning` tokens.

### D2. A second, unofficial accent (indigo) across 13 files — **High**
66 `indigo-*`/`violet-*` usages: AI surfaces (`AIPanel`, `AiSelectionMenu`, `MobileSelectionMenu`, `AiStatusIndicator`), vault surfaces (`VaultModal`, `VaultLockScreen`, `NoteList.tsx:995`), plus `NoteHeader`, `OverflowMenu`, `Sidebar`, `SettingsModal`, `TemplatePickerModal`, `RecentlyDeleted`. Hardcoded — doesn't respond to accent presets (`SettingsModal.tsx:51` writes `--primary` only), dark levels, or colorblind modes. DESIGN.md mandates a single surgical accent.
*Fix:* promote a real `--ai-accent` token, or fold AI/vault back to `--primary`. (Note: the Color Preset layer in the Templates v2 theme system will force this decision anyway — better to make it now.)

### D3. `dark:` variants keyed to OS scheme, not the app's theme class — **High**
No `@custom-variant dark` in `globals.css` (verified); the theme applies via a `.light` class on `<html>` (`layout.tsx:66-68`), but Tailwind v4's default `dark:` variant is `prefers-color-scheme`. 24 `dark:` usages get the wrong branch when OS and app theme disagree: `ui/button.tsx:14` (destructive opacity), `RecentlyDeletedDetail.tsx:264,307,318` (amber banners, `prose-invert`), `TemplatePickerModal.tsx:35`.
*Fix:* add `@custom-variant dark (&:where(:root:not(.light) *));` to globals.css.

### D4. Keyboard focus invisible outside `ui/` primitives; note cards untabbable — **High**
`focus-visible` exists **only** in `components/ui/*`. Raw-button counts with zero focus styles: SettingsModal 35, NoteList 13, QuickBitShell 12, MobileSelectionMenu 12, Sidebar 8 (`NavItem`, `Sidebar.tsx:535`). 37 `outline-none` usages outside ui/. Note cards are clickable `motion.div`s with no `role`/`tabIndex` (`NoteList.tsx:976-987`) — the core list can't be keyboard-navigated; the card options button is hover-revealed with no `focus-visible:opacity-100` (`NoteList.tsx:941-947`). 11 aria-labels total in the app.
*Fix:* shared focus-ring utility on raw buttons; make cards focusable; `focus-visible:opacity-100` wherever `group-hover:opacity-100` appears.

### D5. Typography floor (12px) widely violated — **High**
65 off-scale arbitrary sizes: `text-[10px]` ×22, `text-[11px]` ×22, `text-[9px]` ×8, `text-[8px]` ×1. Worst: SettingsModal (16), TemplatePickerModal (10), NoteList (7). 15 of the 9–10px usages are *also* `text-muted-foreground` (compounds D9). Tag pills at 9px: `NoteList.tsx:1015,1019`; sidebar badges `Sidebar.tsx:234,347`.
*Fix:* bump 8–11px to `text-xs`; if a smaller tier is truly needed, add it to the documented scale once.

### D6. Motion-level system doesn't reach component CSS — **Medium**
Components consume the **base** duration tokens (`--duration-fast` ×7, `--duration-micro` ×8) which are *not* remapped by `[data-motion]`; the remapped `--motion-duration-*` tokens are used **zero** times in components. Plus 11 hardcoded Tailwind `duration-*` classes, and `IconButton`/`ToolbarButton` hardcode `hover:scale-[1.08] active:scale-[0.95]` regardless of motion level (DESIGN.md: `minimal` = no transforms).
*Fix:* s/`--duration-`/`--motion-duration-`/ in components; gate transforms per `[data-motion]` like `.active-elevate-2` already does (`globals.css:514-532`).

### D7. `layout` prop on list items — explicit DESIGN.md violation — **Medium**
`QuickBitList.tsx:420,459` — `layout` on every quick-bit card in both view modes inside `AnimatePresence`. DESIGN.md:381: "Never use `layout` prop on list items."
*Fix:* remove (enter/exit variants already cover it).

### D8. Framer configs re-implemented inline; three divergent ad-hoc springs — **Medium**
~10 inline duration ternaries duplicating `useAnimationConfig` logic (`Home.tsx:61-63,208-209`, `Sidebar.tsx:496,549`, `TemplatePickerModal.tsx:279-282`, `SaveAsTemplateDialog.tsx:119-122`, `NoteHeader.tsx:105`, `TableOfContents.tsx:68-69`); springs forked to 380/30, 320/28, 300/28 vs the canonical 300/22. All motion-level-aware (credit), just forked.
*Fix:* add `panelSlideTransition`/`modalSpring` presets to `use-motion.ts` and consume them.

### D9. Muted text below AA, then further dimmed with opacity — **Medium**
`--muted-foreground` ≈4.4:1 dark / ≈4.2:1 light (under AA 4.5:1), plus 25 usages of `text-muted-foreground/30…/70` (timestamps at `/60`, `NoteList.tsx:1012`) and 15 instances of 9–10px muted text.
*Fix:* raise the token ~5-8 points of lightness; reserve opacity modifiers for decoration.

### D10. `createPortal` + `getBoundingClientRect` pattern persists despite the shadcn rule — **Medium** *(= §R3)*
12 `createPortal` sites in 8 files. Squarely-covered violations: `EditorToolbar.tsx:20,33-42,71,171` (ImageUrlButton), `NoteList.tsx:628`, `QuickBitList.tsx:310`, `Sidebar.tsx:466`, `NotificationCadenceEditor.tsx:113`, `QuickBitShell.tsx:128,236`. (Selection-anchored SlashCommandMenu/AiSelectionMenu are defensible.)
*Fix:* Popover/DropdownMenu/Drawer conversions; ~150 lines die in QuickBitShell alone.

### D11. Six different modal scrim treatments — **Medium**
`bg-black/60` (AISetupModal), `/50` (ui/dialog, alert-dialog, sheet), `/40 + blur` (VersionHistoryPanel:161), `/35` (SettingsModal:561), `/80` (ui/drawer), inline `rgba(0,0,0,0.25/0.3)` styles (TemplatePickerModal:293, SaveAsTemplateDialog:133).
*Fix:* one overlay standard (e.g. `/50`, `/80` for mobile drawers).

### D12. SettingsModal hand-rolls what the ui/ kit provides — **Medium** *(see also §R9)*
35 raw `<button>`s and five bespoke input classNames (`SettingsModal.tsx:975,995,1053,1082,1130`) instead of `ui/input`/`ui/button`; also the largest concentration of off-scale type. Least kit-conformant surface in the app.

### D13. Off-grid 6/10px spacing is systemic (247 usages) — **Low**
`gap-1.5` ×57, `py-1.5` ×46, `py-2.5` ×36… DESIGN.md allows only 4/8/12/16/24/32.
*Fix:* amend DESIGN.md to bless the 2px sub-step for dense chrome rather than churn 247 call sites.

### D14. DESIGN.md radius table uses Tailwind v3 names; `rounded-sm` (2px in v4) slips through ×8 — **Low**
### D15. Zero Tooltip adoption; 92 native `title=` attrs — **Low**
`ui/tooltip.tsx` exists with zero importers; native tooltips are invisible on touch and off-brand.
*Fix:* wire Tooltip into IconButton/ToolbarButton once, centrally.
### D16. Two competing empty-state treatments — **Low**
`ui/empty` used by 2 files; `QuickBitList.tsx:385-388` uses ad-hoc icon+p right next to its `<Empty>`; `NoteList.tsx:701-702` ad-hoc only.
### D17. Stray one-off gradient diverges from the token gradient — **Low**
`QuickBitShell.tsx:687-690` inline `linear-gradient(135deg,#5B93E8,#7B6CE8)` + hardcoded glow vs canonical `.bg-accent-gradient` (`globals.css:371`); won't follow accent presets. Also DESIGN.md:481 claims accent presets are "Not implemented" while `SettingsModal.tsx:28-35,51` ships 8 of them.

**Clean bills:** the 5-layer surface ladder across four themes with hover/border/popover steps, colorblind remaps, motion tokens, and press feedback correctly gated per motion level is genuinely strong; hardcoded hexes are almost entirely justified picker swatches (53/55); `.luminance-border-top` adoption is real (19 files); 50 disciplined `min-h-[44px]` usages (modulo M4's gating); `useAnimationConfig` adopted in 17 files with no raw `duration:` literals outside level-aware code; icon sizing consistent; the two `width` panel animations are deliberate, commented, clip-contained exceptions (document them as sanctioned — see §E11).

---

## §E. Efficiency & performance

Macro architecture is performance-literate (code splitting, editor lifecycle, query caching, indexes, attachment pipeline all match PERFORMANCE.md's own prescriptions — see clean bills). The real risk is concentrated: render hygiene at the root (E1) and the typing loop (E2, E3). E1–E3 ≈ one day of work and most of the mobile-feel win.

### E1. Whole-store Zustand subscriptions in 14 components, including the app root — **High [FOA]**
Selector-less `useAppStore()` destructures in `Home.tsx:41` (verified), `Sidebar.tsx:32`, `QuickBitList.tsx:53`, `SettingsModal.tsx:60`, `QuickBitShell.tsx:311`, `AIPanel.tsx:27`, `AISetupModal.tsx:20`, `RecentlyDeleted.tsx:38`, `RecentlyDeletedDetail.tsx:43`, `QuickBitNotifications.tsx:105`, `AllAttachments.tsx:117`, `TemplatePickerModal.tsx:86`, `SaveAsTemplateDialog.tsx:44`, `hooks/use-ai-action.ts:63`. In Zustand v5 that re-renders on *every* store mutation; `Home` parents the entire tree and children aren't memoized — every search keystroke, modal toggle, or selection re-renders Sidebar + NoteList + shells. The fix is already half-applied: `NoteList.tsx:53-75` and `NoteShell.tsx:37-46` carry a "Fix 5: atomic Zustand selectors" comment — it reached 2 of 16 components.
*Fix:* atomic selectors everywhere; priority Home, Sidebar, QuickBitShell, QuickBitList.

### E2. Full notes-list refetch after every debounced autosave — **High [YJS-partial]**
`NoteShell.tsx:330-331` (verified): every 800ms-debounced save runs `invalidateQueries(getGetNotesQueryKey())` — the *literal* anti-pattern PERFORMANCE.md names. Same in `QuickBitShell.tsx:413`. Every typing pause = PATCH + full list GET (see E5) + list re-render, all session long. Yjs will change the save path, but the invalidation pattern is orthogonal and worth fixing now.
*Fix:* `setQueriesData` in-place patch (already done for pin/fav at `NoteShell.tsx:573-576`); invalidate only on create/delete/move.

### E3. Four to five full-document passes per keystroke — **High [FOA]**
(1) `GrapheEditor.tsx:199-204` (verified): `onUpdate` runs `editor.getHTML()` **and** `editor.getText()` per transaction, stashed for a save 800ms later. (2) `WordCountPopover.tsx:35-44`: recomputes counts on every keystroke *and cursor move even while closed*. (3) `EditorToolbar.tsx:271-279`: full toolbar re-render (~30 `isActive()`/`can()` calls) per transaction. (4) `GrapheEditor.tsx:349-392`: mobile `ensureCursorVisible` does `coordsAtPos` + a `getComputedStyle` DOM walk on both `update` and `selectionUpdate`. Typing cost scales O(doc) × 4–5 — the primary "mid-range Android feels bad" risk.
*Fix:* serialize once inside the debounce callback; gate WordCount on `open`; `useEditorState` selector for the toolbar; cursor-exposure on `selectionUpdate` only.

### E4. KaTeX + lowlight `common` statically bundled into the editor chunk — **Medium-High [FOA]**
`GrapheEditor.tsx:30-37`: `createLowlight(common)` registers ~37 grammars; `@tiptap/extension-mathematics` statically imports KaTeX (~73KB gz; grammars ~50KB gz more). The editor chunk is split from the login shell (good) but loads at app entry for every user — ~120KB+ gz of parse cost for features most notes never use. The roadmap's "code-splittable extensions" item covers this; the language-subset half is doable now.
*Fix:* curated `register()` subset now; lazy math/grammar loading with the Note Type System.

### E5. `GET /api/notes` unpaginated and returns full `contentText` per note — **Medium**
`api/notes/route.ts:66-86`: no `.limit()`, full `contentText` in the list select (PERFORMANCE.md calls it a "preview"; nothing truncates it — it's the entire document text from `editor.getText()`). Combined with E2, the full payload re-downloads after every save pause. 200 notes × long docs = multi-MB JSON on mobile.
*Fix:* `left(content_text, 300)` + cursor pagination. (The existing `content: ''` exclusion shows the right instinct — finish it.)

### E6. Substring search is a sequential scan — **Medium**
`api/notes/route.ts:46-51`: leading-wildcard ILIKE over `title`/`contentText`; only `(userId, deletedAt)`/`folderId` indexes exist (`lib/db/src/schema/notes.ts:23-24`).
*Fix:* `pg_trgm` GIN index (low-effort migration, big headroom).

### E7. Version list ships full `contentText` × 50 versions — **Medium**
`api/notes/[id]/versions/route.ts:59-74`. Opening version history downloads up to 50 full text copies; will show first in the tracked `version_history_open` metric.
*Fix:* `left(content_text, 200)` in the list; the detail endpoint already exists.

### E8. Version POST fires on autosaves when the client cache is cold; prune is an N+1 delete loop — **Medium**
`hooks/use-note-versions.ts:143-157`: the client threshold short-circuit only works if the versions list was ever fetched; otherwise every flushed autosave POSTs. Server does a full-row note SELECT for below-threshold no-ops (`versions/route.ts:111-114`) and prunes with one DELETE per row (`:164-173`).
*Fix:* track last-snapshot meta client-side from POST responses; single `DELETE WHERE id IN (…)`.

### E9. `editor.getHTML()` on every NoteShell render for a closed dialog — **Medium**
`NoteShell.tsx:914-917`: `SaveAsTemplateDialog` is always mounted and receives `noteContent={editor?.getHTML() ?? …}` — a full serialization per render (which E1 makes frequent).
*Fix:* pass a getter; call on open.

### E10. Seven font families (~16 variants) at the root layout — **Medium**
`layout.tsx:2-55`: Geist + Inter(5) + JetBrains Mono(2) + Merriweather(4) + Playfair(2) + Lato(2) + Roboto(2). Self-hosted ✓, but Merriweather/Playfair/Lato/Roboto exist only for the editor FontPicker.
*Fix:* `preload: false` on the four picker-only families; trim Inter weights.

### E11. Sidebar/list panels animate `width` — the project's own forbidden pattern — **Low-Medium**
`Home.tsx:239-243`, `Sidebar.tsx:506-508`. Bounded (enter/exit only), inner content uses transforms, drag-resize uses a MotionValue — the least-bad width animation possible, but still the documented forbidden pattern on a measured transition.
*Fix:* either document as the sanctioned exception in PERFORMANCE.md or move to transform-based slide.

### E12. SettingsModal recreates its countdown interval every second — **Low**
`SettingsModal.tsx:239-243`: `setInterval` with the ticking value in the dep array — teardown/recreate + 1417-line modal re-render per second while the AI tab is open.
### E13. "Temporary" perf `console.log`s ship to production — **Low**
`NoteShell.tsx:190,212,252-257`, `NoteList.tsx:161` (PostHog captures correctly env-gated; the logs aren't).
### E14. Autosave PATCH echoes the full note back; tag updates fetch all folders into JS — **Low**
`api/notes/[id]/route.ts:89-99` (`.returning()` full row incl. `content`), `:74-87`.
### E15. `backdrop-blur` on the always-visible fixed mobile toolbar — **Low**
`GrapheEditor.tsx:474`: persistent backdrop-filter over continuously scrolling content at 95% opacity — continuous GPU refiltering for near-zero visual gain on exactly the target devices.
*Fix:* opaque background on mobile.

**Clean bills:** code splitting right where it counts (NoteShell/QuickBitShell/SettingsModal dynamic; html2pdf/heic2any/sharp all lazy); editor lifecycle matches the anti-pattern guidance exactly (single instance, `shouldRerenderOnTransaction: false`, stable extensions, imperative `setContent`); React Query hygiene (no focus refetch, staleTime, optimistic pin/fav/vault, first-note prefetch, enabled guards, no waterfalls); list endpoint excludes `content`; memoized list items; sound save-pipeline design (debounce+merge+flush, threshold-gated versions); DB indexes cover hot shapes; attachment pipeline well-engineered (parallel uploads, WebP proxies, GIF caps, server-enforced tier limits); zero-re-render drag resize; fonts self-hosted; theme applied pre-paint; no leaks found; perf marks exist and are forwarded to PostHog.

---

## §R. Dead code, duplication, structural bloat

Almost no classically dead code — the bloat is *duplication*, concentrated in the QuickBit-vs-Note parallel universe. The roadmap's "cross-mode unification (Note vs Quick Bit through Note Type System)" is the strategic fix; the extractions below are worth doing sooner because they shrink every mobile surface being actively debugged.

### R1. Eight unused `@radix-ui/*` dependencies (+ deprecated `@types/sharp`) — **High**
`package.json` lists `@radix-ui/react-{dialog,dropdown-menu,label,separator,slot,toast,toggle,tooltip}`; grep for `@radix-ui/` across src/e2e/config: **zero hits** (verified) — everything imports the `radix-ui` monorepo package. `react-toast` doubly dead (Sonner).
*Fix:* remove all nine.

### R2. Seven zero-import `ui/` components — **Medium**
`ui/sheet.tsx`, `label.tsx`, `tooltip.tsx`, `separator.tsx`, `textarea.tsx`, `input.tsx`, `skeleton.tsx` have no importers. Notable: `input.tsx` and `tooltip.tsx` are the solutions to M6 and D15 — *adopt* rather than delete those two; delete or knowingly keep the rest.

### R3. Hand-rolled portal popovers violating the repo's own shadcn rule — **High** *(= §D10)*
`QuickBitShell.tsx:72-188` (ExpiryPicker) and `:192-247` (NotificationPopover) are ~60-line near-copies of each other (identical positioning/listener blocks at :86-114 vs :206-234); same pattern in `QuickBitList.tsx:310-356`, NoteList's mobile plus-menu, and the sort menus.

### R4. `formatExpiry` copy-pasted three times — **Medium**
`QuickBitShell.tsx:44`, `QuickBitList.tsx:33`, `QuickBitNotifications.tsx:15` — same thresholds, same class strings.
*Fix:* `src/lib/format-expiry.ts`.

### R5. NoteList ↔ QuickBitList: ~190 identical lines — **High**
Duplicated wholesale: split "New" button with 30% chevron hit-zone (`NoteList.tsx:548` vs `QuickBitList.tsx:231`), long-press logic (`:579-594` vs `:260-279`), mobile portal plus-menu, sort menu, search row, demo `useQueries` pattern (QuickBitList's comment admits "same pattern as NoteList"), card renderers.
*Fix:* extract `SplitCreateButton`, `ListSortMenu`, `ListSearchInput`, generic card wrapper — both lists shrink ~150-200 lines each.

### R6. NoteShell ↔ QuickBitShell: ~150-200 lines of parallel orchestration — **Medium**
Crossfade effect duplicated verbatim (`NoteShell.tsx:94-147` vs `QuickBitShell.tsx:351-380`, comment admits "mirrors NoteShell"); two different 800ms debounced-save implementations (despite `hooks/use-debounce.ts` existing); near-identical title/content handlers, empty states, demo soft-delete blocks.
*Fix:* `useContentCrossfade`, `useDebouncedEntitySave`, shared `EmptyEditorState`.

### R7. AiSelectionMenu ↔ MobileSelectionMenu: 85 identical lines — **Medium**
Selection-rect tracking effect verbatim (`AiSelectionMenu.tsx:66-82` vs `MobileSelectionMenu.tsx:41-57`), same reset effect and submenu state machine. (Action data already shared — good.)
*Fix:* `useSelectionRect` + shared submenu-state hook; keep the render trees separate.

### R8. Optimistic pin/fav/vault mutations implemented twice, differently — **Medium**
`NoteShell.tsx:548-590` vs `NoteList.tsx:297-330+` — same cache surgery in two styles; NoteList's pin and fav blocks are copy-pastes with one field swapped.
*Fix:* one `useOptimisticNoteToggle(field)` hook.

### R9. SettingsModal.tsx: 1417 lines, six jobs — **High**
Theme/accent application (:27-58), AI provider state + key CRUD (~:101-403, with its own raw `authenticatedFetch` calls), security/PIN (:404-510), tab shell (~:560-682), appearance tab (~160 lines), **AI tab :843-1247 (~405 lines — a bigger component than most of the app)**, then data/security/quickbits/account tabs + footer dispatch.
*Fix:* `settings/` directory: shell + per-tab components + `use-ai-settings.ts`.

### R10. Dead duplicate seed script — **Medium**
`lib/db/seed-templates.ts` vs `scripts/seed-templates.ts`: 196 lines each, differing in exactly one import line; only the scripts/ copy is referenced.

### R11. Dead exports — **Low**
`getDemoAttachments()` (`use-attachments.ts:94`), `useDarkModeLevel()`/`useColorblindMode()` (`use-atmosphere.ts:14,18`), `scripts/src/hello.ts` (+ its npm script).

### R12. ~30MB of untracked junk; generated paths missing from .gitignore — **Medium**
`resize-image.mov` (22MB, repo root); `reference images/` (2.5MB) is byte-identical to `artifacts/next-app/public/test-images/` (verified) — and anything in `public/` ships to production if committed; `study/` (2.8MB, tiptap-pro trial + novel-sh clones — per the scratch-branch protocol these should be deleted after study); `.gitignore` missing `playwright-report/`, `test-results/`, `perf-results/`, `.cache_ggshield`. One careless `git add -A` commits all of it.

### R13. Perf console.logs in production paths — **Low** *(= §E13)*

**Files >300 lines** (top of table): SettingsModal 1417 · NoteList 1051 · NoteShell 920 · QuickBitShell 755 · TemplatePickerModal 620 · Sidebar 558 · QuickBitList 496 · GrapheEditor 492 · attachments/upload route 489 · EditorToolbar 484. (23 files total ≥300.)

**Clean bills:** every heavy dependency verified in use (html2pdf, turndown+gfm, diff-match-patch, lowlight, katex, sharp, heic-convert *and* heic2any — legitimately both sides, jose, posthog-node, vaul, bcryptjs); every Zustand slice consumed; all non-ui components and all hooks have importers; no dead CSS (the `.hljs-*` selectors are runtime-generated — deliberately ruled out as false positive); zero TODO/FIXME comments, zero commented-out blocks, no debug routes.

---

## §A. Architecture & documentation drift

The codebase is in good architectural shape; the problem is that **master's docs describe a parallel universe in three places**. Since the docs drive agent sessions, wrong claims cause bad future work.

### A1. Docs describe an onboarding system that was never merged — **High**
CLAUDE.md:261-268 documents `OnboardingModal.tsx`, `use-onboarding.ts`, `POST /onboarding`, Zustand onboarding state. **None exist on master** (verified: zero files matching `*onboarding*`). All four files live only on unmerged `feature/onboarding` (last commit 2026-04-24). Contamination: CLAUDE.md:86, :193, :578 and TESTING.md:90 (`07-onboarding.spec.ts` — absent). Internal contradiction: CLAUDE.md:266 says the hook checks `user_settings.onboardingCompleted`; the schema (and CLAUDE.md:86 itself) says that column doesn't exist.
*Fix:* explicit merge-or-kill decision on `feature/onboarding` (10 weeks stale, will conflict with the shadcn migration); update the docs to match the outcome.

### A2. openapi.yaml drifts from route handlers in both directions — **High**
Phantom paths (spec, no handler): `/auth/user`, `/login`, `/callback`, `/logout`, `/mobile-auth/token-exchange`, `/mobile-auth/logout` (openapi.yaml:936-1037) — an OIDC/mobile flow that doesn't exist. Missing paths (handler, no spec): all 5 `/ai/*`, all 5 `/attachments/*`, all 3 versions paths, `/quick-bits/expired` — 42 handlers vs 31 spec paths. Codegen itself is in sync (all 43 operationIds present in the generated client) — the drift is spec↔handlers.
*Fix:* add the missing families, delete or mark the phantoms, regenerate. Note: `/mobile-auth/*` may be *aspirational* for the Capacitor era — if so, label it as such rather than deleting.

### A3. "Never write raw fetch" mandate violated in 8 app files — **Medium**
`authenticatedFetch` (raw-fetch wrapper) used in `AISetupModal.tsx:26`, `AIPanel.tsx:76,105,115`, `QuickBitNotifications.tsx:162,198`, `NoteList.tsx:281,421`, `use-attachments.ts`, `use-note-versions.ts` — a structural consequence of A2 (can't use generated hooks for unspecced endpoints).
*Fix:* after A2, migrate; amend the rule to name the sanctioned escape hatch for anything that remains.

### A4. Observability gaps — **Medium**
59 client + 9 server `posthog.capture` sites (good breadth), but: **attachment upload/delete has zero capture** (whole feature vertical invisible to analytics), no find/replace events, no plain `quick_bit_created` (only `_from_template`), no version-delete event. Sentry: 41/42 API routes covered ✓, but client hooks `use-attachments.ts`, `use-note-versions.ts`, `use-note-export.ts` have **zero** `captureException` — failures surface only as toasts, violating DoD item 4.

### A5. Stale facts in CLAUDE.md/ARCHITECTURE.md — **Medium**
GrapheEditor "~363 lines" → actually 492; ARCHITECTURE.md lists `PATCH /templates/:id` → route exports DELETE only; directory tree omits 5 components (NotificationCadenceEditor, PinPad, QuickBitNotifications, RecentlyDeletedDetail, VersionPreviewArea); `demo-context.tsx` → actual file is `.ts`.

### A6. Demo mode: AI setup flow lacks demo guards — **Medium**
16 files apply the demo cache-patching pattern consistently; `use-ai-action.ts` and `AISetupModal.tsx` have zero demo references, yet AISetupModal posts to `/api/ai/settings` — a 401 in demo mode.
*Fix:* verify manually; add a demo guard.

### A7. TESTING.md spec inventory wrong in both directions — **Medium**
Claims 9 specs 01–09 incl. 07-onboarding; actual: 10 files — 01–06, 08–11; no 07; 10 (`ordered-list-nesting`) and 11 (`editor-enhancements`) undocumented.

### A8. `pnpm-workspace.yaml` references nonexistent `lib/integrations/*` — **Low**
### A9. `theme_mode`/`theme_accent` written from two components with no owning hook — **Low**
`Sidebar.tsx:65` and `SettingsModal.tsx:69,505-506` — motion and atmosphere have owning hooks; theme doesn't.
*Fix:* `use-theme.ts`.

### A10a. E2E suite has been red on master's merge path since ≥2026-05-24 — **High**
Discovered while validating this audit's own PR: the same three tests in `e2e/11-editor-enhancements.spec.ts` (`:45` turn-into strict-mode violation — `.ProseMirror ul li` resolves to 7 elements; `:78` toggle-block click timeout; `:109` image-resize — `Insert` button resolves to 4 elements) failed on this doc-only PR **and** on the last CI runs before PRs #109/#110 were merged (verified via `gh run list`: every non-CodeQL CI run since 2026-05-10 concluded `failure`). The suite added with the image-resize/editor-enhancement work rotted immediately, and merges have been proceeding over red CI — which silently voids the "CI must pass before merge" convention and masks any *new* regressions the other 45 tests would catch.
*Fix:* repair the three specs on a `test/fix-editor-enhancements-spec` branch (selectors need strict-mode-safe scoping, e.g. `.first()`/`getByRole` within the block), then make E2E a required status check so red CI blocks merges again.

### A10. 27 unmerged branches — mostly squash-merge leftovers, one live, one lost — **Low**
Verified clusters: ~20 squash-merged leftovers safe to delete (RLS/security cluster → PRs #88/#93/#94; docs cluster; refactor/infra cluster; ~8 April mobile-fix branches). Genuinely pending: `fix/mobile-polish-and-toolbar-bugs` (2026-05-26, **newer than master's head** — contains the keyboard-flicker fixes, see M8). Genuinely lost: `feature/onboarding` (see A1). Abandoned: `claude/happy-lamport`.
*Fix:* bulk-delete merged refs; land the mobile branch; decide onboarding.

**Clean bills:** exactly 13 tables as documented; `user_settings` 4-column claim exact; localStorage surface is exactly the 5 documented keys; ARCHITECTURE.md's endpoint list accurate to one error (more accurate than openapi.yaml); OBSERVABILITY.md event list fully in sync (all 37 events found, none undocumented); Zustand store lean and disciplined with dev-gated window exposure; editor layering rule respected; CI exists and is well-constructed; `use-mobile` thresholds exactly as documented.

---

## §S. Security

Per the repo's own policy (SECURITY.md / CLAUDE.md file-storage rules), **unfixed vulnerability details are not committed to this file**. The full findings — **0 Critical, 4 Medium, 6 Low** — were reported in the audit session output, and will be documented here (pattern + resolution) after fixes merge.

What can be said here (clean bills, verified in source):
- **Auth coverage: 38/38 authenticated routes** validate the session and 401 on null; the two exceptions (healthz, cron) are by documented design; the jose/JWKS middleware backstop matches SECURITY.md exactly.
- **No IDOR found:** every ownership-sensitive WHERE clause includes `userId`; nested resources verify parent ownership first.
- **RLS fully evidenced in-repo:** migrations 0001–0005 enable RLS + policies on all tables, including the `(select auth.uid())` performance pattern and the storage-tier self-promotion guard.
- **Encryption (`lib/encryption.ts`) correct:** fresh random 12-byte IV per encryption, GCM tag verified, 64-hex key enforced at module load; decrypted keys never returned to the client except the documented local-LLM exception.
- **No SQL injection** (Drizzle-parameterized throughout; LIKE wildcards escaped); **no secrets in the repo**; **no open redirect**; CSP/headers as documented; service-role client unreachable from client bundles.

The four Medium items concern: vault enforcement depth, one HTML-rendering path, one third-party key-transmission pattern, and cron-secret comparison. All are fixable in ~a day total; a `fix/security-audit-jul-2026` branch is the suggested vehicle.

---

## §G. AI layer — architecture, prompts, and always-on readiness

*Added in a second audit wave (two dedicated passes), grounded in the locked **AI Provider Architecture v2** spec (Notion): three paths (Graphe Free w/ self-healing model selection · unified 9-provider BYOK w/ `/v1/models` discovery · Local LLM), pure-code smart routing (light/primary/embedding by action + ~500-char threshold), a specified error-handling contract, and Phase 6 = the proactive always-on assistant.*

**How a request flows today:** selection menu → `use-ai-action.ts` builds a plain-text prompt from `ai-prompts.ts` → fresh `GET /api/ai/settings` on *every* call → local LLM: browser POSTs directly to the user's endpoint; cloud: `POST /api/ai/generate` → per-provider if/else (Gemini/OpenAI/Anthropic) → blocking fetch, `maxOutputTokens: 1024` → full response → client replaces the selection. No streaming, no cancellation, no timeout. The AI panel duplicates this pipeline independently; the first-run setup queue duplicates it a third time.

### Spec-vs-code gap table

| Spec pillar | Status | Evidence |
|---|---|---|
| Free tier self-healing model selection | **Hardcoded** — literal `"gemini-2.5-flash-lite"` constants | `lib/ai-model-router.ts:1-3` |
| BYOK 9-provider dropdown | **3 of 9** (Google AI Studio, OpenAI, Anthropic); no OpenRouter/Groq/Mistral/Together/Fireworks/custom | `api/ai/generate/route.ts:13-19` |
| Model discovery = connection test | **Partial** — OpenAI + Anthropic only | `api/ai/models/route.ts:8` |
| Local LLM `/v1/models` discovery + classification | **Missing** — manual URL + manual model-name field | `SettingsModal.tsx:1178-1191` |
| Multi-provider storage, one active, tap-to-switch | **Implemented** ✓ | `SettingsModal.tsx:286-298` |
| Smart routing (roles, char threshold, action table) | **Stub** — `taskType` plumbing exists, every call site hardcodes `"manual"` (verified) | `use-ai-action.ts:95`, `AIPanel.tsx:79` |
| 429 → respect Retry-After, one auto-retry | **Dead code** (G1) | `use-ai-action.ts:255` |
| Local-server-down toast w/ Retry + Switch | **Missing** — plain banner | `AiStatusIndicator.tsx` |
| Token-limit friendly error | **Missing** — no finishReason check anywhere | `generate/route.ts` |
| Free-tier usage meter | **Implemented** ✓ (stale after generate — G15) | `SettingsModal.tsx:922-946` |

### Correctness bugs in the AI layer

**G1. The 429 auto-retry provably never fires — High.** `use-ai-action.ts:255` branches on `data.reason === "rpm_limit"`, but the server's RPM-429 carries the value under a different field (`generate/route.ts:126-131`); `reason` only ever holds `hourly/monthly_limit_reached`. Verified. The dead branch means a real Gemini RPM 429 falls through to a second `res.json()` on a consumed body → TypeError → generic error. The server's `retryAfterMs` is ignored (client hardcodes a 65s sleep) — and the "AI is busy, retrying…" message is unreachable UI because `AiStatusIndicator.tsx:13` shows the loading branch whenever `aiLoading` is true. No cancel affordance exists during the 65s wait.

**G2. "Continue writing" is a shipped no-op — High.** `AiSelectionMenu.tsx:329` fires `onAction("continue_writing")`; no such template exists in `ai-prompts.ts` (verified) → `buildAiPrompt` returns null → silent bail at `use-ai-action.ts:85`. Doubly dead: `callAI` requires a non-empty selection, contradicting continue-writing semantics.

**G3. Stale-position replacement can corrupt unrelated text — High.** The editor stays editable during generation (`GrapheEditor.tsx:444-458` only hides the menu); saved selection positions are never mapped through subsequent transactions before `insertContentAt({from, to})` (`use-ai-action.ts:69-71, 304`). Typing during a multi-second (or 65-second, G1) request makes the result land on the wrong range.

**G4. Silent truncation replaces the full selection — High.** All cloud providers capped at `maxOutputTokens: 1024` (`generate/route.ts:117,211,272,309`); no `finishReason` check server-side, no length sanity check client-side. `longer_50` on a long selection returns a cut-off tail that *replaces* the user's full text (recoverable only via the pre-AI snapshot).

**G5. Generative actions destructively replace; "No action items found." overwrites user text — High.** No preview/accept step for any action; summarize deletes the selection and leaves the summary, and `extract_action_items`' literal "No action items found." sentinel replaces the selection (`ai-prompts.ts:24-28` + uniform apply path).

**G6. AIPanel "Insert into note" is silently lost — High.** `AIPanel.tsx:150-158` appends to `note.content` via the API, but the open editor only reloads on `contentKey` change (`GrapheEditor.tsx:229-258`) — the insertion is invisible and the next autosave overwrites it. Also interpolates raw model output into stored HTML unescaped.

**G7. AI panel drops the local-LLM auth key + think-tag stripping — High.** `AIPanel.tsx:60-68` sends no `Authorization` header (its settings type omits `localLlmApiKey`), skips `stripThinkTags`, uses `max_tokens: 1024` vs the toolbar's 4096 — same feature, four behavioral differences, because the pipeline is forked (G8).

**G8. The request pipeline exists four times and has drifted — High.** (a) `use-ai-action.ts:192-313`, (b) the first-run queued-action closure `:114-177` (reimplemented inline, *without* 429 handling, error mapping, or analytics), (c) `AIPanel.tsx:41-148`, (d) three per-provider if/else blocks server-side (Gemini error block duplicated verbatim at `generate/route.ts:122-148` and `:216-242`; OpenAI/Anthropic errors leak under misnamed `geminiStatus`/`geminiMessage` keys). *Fix:* one shared `executeAiRequest()` client-side + provider-adapter map server-side.

**G9. Demo mode AI is a guaranteed 401 dead end — Medium.** Demo skips the settings fetch but still POSTs to the authenticated route with no session (`use-ai-action.ts:102,244`; `AIPanel.tsx:76,103`) → "AI key invalid or missing. Check Settings." — settings demo users don't have. *Fix:* canned demo responses or a "Sign up to use AI" state.

**G10. Settings UI offers a Google AI Studio model override the router deliberately ignores — Medium.** `SettingsModal.tsx:307,993-1003` shows and saves it; `ai-model-router.ts` `google_ai_studio` case has an explicit comment "User model override is not supported for this provider" (verified). One of the two is wrong — remove the field or honor it.

**G11. Enter-key double-fire + uncapped whole-note context in the panel — Medium.** `AIPanel.tsx:248-251` checks only `prompt.trim()`, not `isPending` — mashing Enter fires concurrent duplicate requests, each burning quota. `AIPanel.tsx:47-50` prepends full `title + contentText` with no truncation.

### Prompt quality (`lib/ai-prompts.ts` — 21 templates)

Scorecard: **Consistency: strong** (one file, one voice, one "Return only…, no explanations" contract on all 21 — verified no duplication elsewhere) · **Output contract: adequate** (no post-processing if the model disobeys; chatter/markdown fences reach the document verbatim) · **Format safety: weak** · **Determinism: weak** · **Edge cases: weak** · **Injection: weak**.

**G12. No role separation or data fencing — High.** Every prompt is `"<instruction>: \n\n${selectedText}"` as a single user message — no `systemInstruction`, no delimiters, no "the following is data, not instructions" (`ai-prompts.ts:9-28`, `generate/route.ts:116,271,310`). On a flash-lite-class model, note text that *reads* like an instruction ("TODO: rewrite this as bullets") gets executed instead of transformed. Mandatory before any always-on scanning of arbitrary note content.

**G13. Plain-text in, HTML-parsed out — formatting destroyed both directions — High.** Selections extracted via `textBetween(from, to)` (all marks/structure invisible to the model, destroyed on replace) — and **with no block separator** (verified at `use-ai-action.ts:79`, `AiSelectionMenu.tsx:80`, `MobileSelectionMenu.tsx:54,125,133`): two selected paragraphs are sent as `…end of one.Start of two…`. Output goes through `insertContentAt(range, string)` which Tiptap parses as HTML: model newlines collapse to spaces (bulleted summaries become one run-on paragraph), `**bold**` lands as literal asterisks. *Fix:* HTML-in/HTML-out prompting with tag-preservation instructions, `blockSeparator: "\n\n"` at minimum.

**G14. Zero generation config — proofread runs at Gemini default temperature 1.0 — Medium.** No `temperature`/`topP` anywhere (verified repo-wide): "Do not change wording or structure" (proofread) at temp 1.0 on flash-lite paraphrases; retries are non-reproducible. *Fix:* per-action config (~0-0.2 mechanical, ~0.7 creative) carried alongside each template.

**G15. Unverifiable length targets, no output validation, no language preservation — Medium.** "approximately 25% shorter" (small models can't self-measure percentages; nothing validates the result); no "respond in the same language as the input" on any template — non-English proofreads can come back translated.

### Efficiency & plug-and-play

**G16. Fully blocking send/receive: no streaming, no cancel, no timeout, plus a settings round-trip per call — High.** `stream: false` explicit (`use-ai-action.ts:141,215`, `AIPanel.tsx:67`); zero `AbortController`; no upstream timeout (a hung provider holds the Vercel function to platform kill); every toolbar action first awaits `GET /api/ai/settings` (`use-ai-action.ts:104`). *Fix:* SSE streaming route + AbortController + `AbortSignal.timeout` + cache the active provider in React Query.

**G17. Provider support is copy-paste if/else across ~7 files — provider #5 is a multi-file change — High.** Adding one provider touches `generate/route.ts` (~60-line bespoke block), `keys/route.ts:8`, `models/route.ts`, `ai-model-router.ts`, `SettingsModal.tsx` (OpenAI vs Anthropic already cost ~20 parallel useState hooks, `:112-129`), and possibly `use-ai-action.ts`. Since 6 of the 9 spec providers are OpenAI-compatible, a `{baseUrl, authHeader, parse}` adapter table collapses nearly all of this — the single highest-leverage refactor for the spec's Phase 2.

**G18. No token accounting in the DB; BYOK usage invisible; rate limiter races — Medium.** `totalTokensUsed` column never written (TODO at `lib/ai-rate-limit.ts:115`); BYOK requests don't touch `ai_usage` at all; the free-tier limiter is a non-atomic read-check-update that also runs a full-table `SUM(requests_this_month)` per request and increments *before* the upstream call (failures still consume quota). Per-request tokens go to PostHog but without the action name — you can rank actions by trigger count but not by outcome or cost (`ai_selection_action_triggered` also skips the local-LLM path entirely).

**G19. Free-tier model names hardcoded — no self-healing — Medium.** `ai-model-router.ts:1-3`; when Google retires 2.5-flash-lite every free-tier user breaks until a deploy. `parseGeminiError` already classifies `model_unavailable` (`ai-error-handler.ts:59-64`) but nothing acts on it. *Fix:* cached server-side models poll + pick-lightest + 404→rediscover.

**G20. iOS selection-menu conflict is real and still open — Low.** `-webkit-touch-callout: none` + mobile `contextmenu` preventDefault exist (`globals.css:196`, `GrapheEditor.tsx:397-403`) but neither suppresses iOS Safari's text-selection edit menu in contenteditable — the native bar and `MobileSelectionMenu` will stack. Matches the roadmap's open "AI toolbar fix (iOS native copy/paste conflict)" item; nothing in code addresses it yet.

### Phase 6 (always-on assistant) readiness

**Essentially zero — by design gap, not bad code.** What's reusable: the `taskType` router skeleton (`background`→flash-lite / `manual`→flash / `deliberate`→pro) is genuinely the right cost-tiering shape — it's just never exercised. The prerequisites, in dependency order:
1. **Message-array API with system/user separation** (G12) — the single-concatenated-string request shape makes injection isolation and multi-turn impossible.
2. **Structured output contract** — a JSON suggestion schema (`{type, noteId, anchor, title, body, confidence}`) with zod validation server-side; zero zod in the AI route today, and Gemini's native `responseSchema`/JSON mode is unused. (Compare: the sibling app's zod-validated plan pass.)
3. **Wire the routing table** — implement the action→role + ~500-char threshold mapping so a background scanner can actually reach the light model.
4. **Rate-limit redesign** — 5/hr + global monthly circuit breaker cannot host background scanning; needs per-taskType budgets.
5. **Context assembly layer** — today's only context builder is AIPanel's uncapped string concat; chunking, embeddings, pgvector (spec Phase 4) are a full subsystem away.
6. **Suggestion hygiene** — dedupe keys, per-note scan cursors/hashes, cooldowns, per-user daily suggestion caps: none exist.
7. **Resolve the local-LLM reachability constraint** — local models are client-called by design (`generate/route.ts:50-55`), so a *server-side* background worker can never reach them; Phase 6 needs a client-resident scheduler or a rethink.

**Clean bills:** key handling is right where it matters (AES-256-GCM at rest, `/api/ai/keys` GET returns metadata only, BYOK keys never reach the client; the local-LLM key return is a documented, commented exception); multi-provider storage + tap-to-switch matches the spec, with a thoughtful only-commit-configured-providers guard; discovery-as-connection-test genuinely works for OpenAI/Anthropic; BYOK applies uniformly to both call sites (no silent free-tier fallback for authed users); undo is clean (single transaction + automatic `pre_ai_rewrite` version snapshot — genuinely good safety design); `stripThinkTags` shows real local-model awareness; error taxonomy in `ai-error-handler.ts` maps distinct causes to actionable messages; the deferred-action first-run setup queue is a sound UX pattern (its triplicated implementation is the problem, not the idea); empty-selection and image-node-selection cases are guarded; PostHog server client configured correctly for serverless.

**Verdict:** the prompt *file* is disciplined and consistent, but it encodes a plain-text, single-message, fire-and-replace model that is the wrong substrate for the always-on assistant — and the request layer around it is the weakest part of the app: blocking, uncancellable, forked four ways with visible drift, with a dead retry path and several silent data-loss edges. The highest-leverage sequence: (1) unify the four pipelines behind one client module + server adapter table (G8/G17 — also delivers 6 more BYOK providers nearly free), (2) rebuild the prompt contract as system-role + fenced HTML + per-action generation config (G12-G14), (3) wire the dormant taskType routing. Do those three and both the "plug and play" goal and the Phase 6 foundation are real.

---

## §F. Roadmap alignment — what to fix now vs. what Templates v2 absorbs

| Finding cluster | Now or later? | Rationale |
|---|---|---|
| M1 safe-area, M2 back-stack, M4/M5 touch gating, M9-M11, M15 | **Now** | Needed web-side regardless of Capacitor plugins; all are prerequisites for a credible wrap |
| M8 keyboard heuristics | **Land the branch now**; replace with `@capacitor/keyboard` at wrap time | The branch is already newer than master |
| M3 offline data | **Phase 1 (Yjs)** — but add the cheap online/offline listener now | IndexedDB persistence is the designed fix |
| M16 storage/auth abstraction | **Before the wrap** | Maps directly to the locked `@capacitor/preferences`/secure-storage plugin row |
| E2 save-path chatter, E8 version POSTs | **Fix the invalidation now**; Yjs deltas later absorb the payload half | The roadmap's "smaller per-keystroke saves" row assumes Yjs — but E2's list-invalidation is orthogonal and cheap |
| E1, E3, E9, E12 render hygiene | **Now [FOA]** | Exactly the "editor perf audit / NodeView memoization" line items already tracked in the Foundation Optimization Audit |
| E4 bundle | **Half now** (lowlight subset, font preloads E10), half with Note Type System code-splitting | Roadmap explicitly plans per-modality splits |
| R5/R6 Note↔QuickBit duplication | **Extract shared primitives now**; full unification via Note Type System ("cross-mode unification" is a tracked FOA item) | Don't build the Note Type System on top of two divergent copies |
| D1-D6 token/motion/dark/focus | **Now** | The four-layer theme system (Decision 8) will sit on these tokens; Color Presets can't ship over 96 hardcoded palette colors and a second hardcoded accent |
| G1-G11 AI correctness bugs | **Now** | Dead retry, no-op button, stale-position/truncation data loss — user-visible today |
| G8/G17 pipeline unification + adapter table | **Now** — it *is* spec Phase 2 (BYOK consolidation) | One refactor delivers 6 more providers and kills the drift class |
| G12-G15 prompt contract v2 | **Before Phase 6**, ideally now | System role + fenced HTML + per-action config; every prompt written on the old substrate is rework later |
| G16 streaming/cancel/timeout | **Now** | The single biggest perceived-quality lever for AI UX; also required for always-on |
| G19 self-healing model selection | **Spec Phase 3** — as planned | Cheap once the adapter table exists |
| A1/A2 doc truth | **Now** | Docs drive agent sessions; every future Templates v2 session inherits the drift |
| §S security items | **Now** | Small, and the vault item affects what "Capacitor secure storage" needs to mean |

---

## One-page summary

**The good news:** the foundations this app's docs brag about mostly exist. Auth/RLS/encryption check out end-to-end. The editor lifecycle, code splitting, query caching, and attachment pipeline match the performance guide's own prescriptions. The token/theme/motion architecture is real and thoughtful. There is almost no dead code, no TODO rot, and the observability schema doc matches reality. Mobile navigation, long-press handling, and keyboard math show real care.

**The five things that matter most, in goal order:**
1. **Mobile:** three independent wrap blockers — no safe-area/viewport-fit handling anywhere (M1), no back-stack integration (M2), no offline story (M3) — plus a systemic "touch = narrow viewport" confusion (M4/M5/M10/M11) that leaves iPads with sub-44px targets and some actions untappable. The best keyboard fixes are sitting unmerged on `fix/mobile-polish-and-toolbar-bugs`.
2. **Design:** the system is better than the implementation. 96 raw palette colors defeat the colorblind feature (D1), 66 indigo usages form an unofficial second accent (D2), `dark:` variants key off the OS instead of the app (D3), and keyboard focus/tabbability fall short of "Crafted" (D4). ~A week of mechanical cleanup.
3. **Performance:** two concentrated problems — whole-store subscriptions in 14 components including the root (E1), and 4-5 full-document passes per keystroke plus a full list refetch per save pause (E2/E3). ~A day of work for most of the mobile-feel win.
4. **Leaner code:** the QuickBit surfaces are a sustained copy-paste of the Note surfaces (~190 identical list lines, parallel shells, `formatExpiry` ×3); SettingsModal is 1417 lines with a 405-line AI tab; eight dead Radix deps; 30MB of untracked junk one `git add -A` away from history.
5. **Docs:** master's docs describe an onboarding system that only exists on a 10-week-old unmerged branch (A1), and the OpenAPI spec is missing four endpoint families while containing six phantom ones (A2) — which structurally forces the raw-fetch violations the same docs forbid.

**Security:** no Criticals; 4 Mediums reported in-session per policy (not in this file until fixed).

**AI (added in the second wave, §G):** the request layer is the weakest part of the app — blocking and uncancellable, forked four ways with visible drift, a dead 429-retry path, and several silent data-loss edges (stale-position replacement, 1024-token truncation, the panel's lost inserts). The prompt file is disciplined but built on the wrong substrate for the planned always-on assistant (plain text, single user message, no fencing, no structured output, temp 1.0 on proofread). Plug-and-play is 3 of 9 spec providers via copy-paste if/else; one adapter-table refactor closes most of the gap. Always-on readiness: the taskType router skeleton is right and dormant; seven concrete prerequisites listed in §G.

**Suggested phasing** (one branch per phase, PR each, aligned to the Templates v2 timeline):

| Phase | Branch | Contents | Est. |
|---|---|---|---|
| 1 | `fix/security-audit-jul-2026` | The 4 Mediums + cheap Lows from §S | ~1 day |
| 2 | (existing) `fix/mobile-polish-and-toolbar-bugs` | Land it — it's newer than master | review only |
| 3 | `fix/mobile-wrap-blockers` | M1 safe-area + M2 back-stack + M9 overscroll + M6/M7/M15 | 1-2 days |
| 4 | `fix/touch-not-width` | M4, M5, M10, M11 + adopt ui/input & Tooltip (R2/D15) | 1-2 days |
| 5 | `perf/render-hygiene` | E1 selectors, E2 invalidation, E3 typing loop, E9, E12, E13 | ~1 day |
| 6 | `fix/design-tokens` | D1 semantic sweep, D2 accent decision, D3 dark variant, D6 motion tokens | 2-3 days |
| 7 | `refactor/shared-primitives` | R3-R8 extractions + R9 SettingsModal split + R1/R10-R12 deletions | 2-3 days |
| 8 | `chore/docs-truth` | A1 decision, A2 spec true-up + A3 migration, A5/A7 refresh, D13/D14 doc amendments | ~1 day |
| 9 | `fix/ai-correctness` | G1-G7, G9-G11 (dead retry, no-op button, stale positions, truncation, lost inserts, demo dead end) | 1-2 days |
| 10 | `refactor/ai-pipeline` | G8 unify pipelines + G17 provider adapter table (= spec Phase 2, delivers 6 more BYOK providers) + G16 streaming/cancel/timeout + G18 token accounting | 3-4 days |
| 11 | `feat/prompt-contract-v2` | G12-G15: system role + fenced HTML-in/HTML-out + per-action generation config + wire taskType routing — the Phase 6 substrate | 2-3 days |

Independent phases: 1, 5, 6, 9 can run in any order; 3-4 before any Capacitor work; 7 before Templates v2 Phase 2; 8 before the next agent-driven feature session; 10 before 11; 11 before any Phase 6 (always-on) work.

---

*End of Stage 1. Generated 2026-07-04 from six verified audit passes. Security details withheld per SECURITY.md policy — see session output. A Stage 2 grounded roadmap (Rent-Tool format, with session prompts) can be generated from this document on request.*
