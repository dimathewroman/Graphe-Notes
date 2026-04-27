# Design System

Reference for all visual decisions in Graphe Notes. Read this before making any UI or styling change.

The authoritative source for design philosophy is the **Design Philosophy Manifesto v1.3** in Notion (Graphe Notes → Agent Workspace). This file documents the implemented state — where code and manifesto diverge, code wins.

---

## Design Principles

Three principles govern every visual and interaction decision:

**Calm** — The interface recedes so the writing can come forward. Low visual noise, warm neutrals, restrained use of accent color. Nothing pulses, spins, or demands attention unprompted.

**Crafted** — Details are precise. Corners are rounded. Spacing is on-grid. Shadows are warm-toned. Transitions feel mechanical not digital. Every element earns its space.

**Alive** — The interface responds to touch with subtle physics. Springs, not linear tweens. Gentle feedback on press. The editor has weight — it doesn't float.

These principles originated from building for ADHD users who are overwhelmed by busy interfaces. They apply equally to all users.

---

## Color System

All colors are HSL CSS variables set on `:root` (dark default), `.light`, and dark-level selectors. Components use Tailwind utility classes that resolve to `hsl(var(--token))`.

### Dark Default (`:root`)

The default mode. Warm dark, slightly cool-hued. Surface lightness increases with elevation.

```
--background:      228 25% 5%    #0E1017  Base layer
--panel:           229 20% 10%   #14161F  Surface 1 (sidebar, side panels)
--card:            229 16% 13%   #1B1E28  Surface 2 (note list cards)
--editor:          230 11% 20%   #2A2D3A  Surface 3 (editor area)
--popover:         229 10% 23%   #323542  Elevated (dropdowns, modals, tooltips)
--panel-border:    228 14% 18%   #272A35
--foreground:      252 7% 94%    #F0EFF2
--muted-foreground:249 3% 49%    #7B7A82
--primary:         216 78% 63%   #5B93E8  Accent (soft periwinkle)
--primary-hover:   216 78% 68%
```

### Soft Dark (`[data-dark-level="soft"]`)

Warmer, lighter. Best for ambient lighting situations.

```
--background:  224 18% 14%   #1C1F28
--panel:       224 15% 18%   #242832
--card:        224 13% 21%   #2B2F3B
--editor:      224 10% 27%   #38404F
--popover:     224 10% 29%   #3D4453
```

### OLED Dark (`[data-dark-level="oled"]`)

True black. Saves battery on OLED displays; high contrast borders carry depth instead of lightness steps.

```
--background:  0 0% 0%        #000000
--panel:       228 25% 4%     #090A10
--card:        228 20% 6%     #0D0F18
--editor:      228 14% 10%    #151820
--popover:     228 13% 13%    #1A1C26
```

### Light Mode (`.light`)

Warm off-white and stone. Same primary accent; surfaces use warm beige instead of dark.

```
--background:  36 18% 95%   #F5F3EF
--panel:       36 14% 91%   #EDEBE6
--card:        0 0% 100%    #FFFFFF
--editor:      0 0% 100%    #FEFEFE
--popover:     0 0% 100%    #FFFFFF
--foreground:  0 0% 24%     #3C3C3C
```

### Semantic Colors

```
--color-destructive-hsl:  0 72% 51%    red
--color-success-hsl:     160 84% 39%   green
--color-warning-hsl:      38 92% 50%   amber
```

These are overridden by colorblind mode selectors (see below). Always use `text-destructive`, `text-success`, `text-warning` rather than hardcoded color classes — colorblind remapping only works if you use these tokens.

### Colorblind Modes

Set via `data-colorblind` attribute on `<html>`.

**Protanopia / Deuteranopia** (`[data-colorblind="protanopia"]`):
```
--color-destructive-hsl:  25 90% 55%   orange  (was red)
--color-success-hsl:     210 88% 56%   blue    (was green)
```

**Tritanopia** (`[data-colorblind="tritanopia"]`):
```
--color-warning-hsl:  330 80% 60%   pink/magenta  (was amber, which looks white to tritanopes)
```

### Accent Philosophy

Accent (`--primary`, `#5B93E8`) is used surgically:
- Primary action buttons
- Active navigation indicators
- Selected state indicators
- Link text
- Focus rings

More accent ≠ better. A single accent element per view is the target. The accent gradient (`bg-accent-gradient`) — `#5B93E8 → #9067EE` — is for covers and promotional surfaces only, not UI chrome.

---

## Typography

### Font Stack

| Role | Font | Source |
|---|---|---|
| UI / body | Geist Sans | Self-hosted via `geist` npm package |
| Code / monospace | JetBrains Mono | Google Fonts CDN |
| Editor: default | Geist Sans | Inherited |
| Editor: serif | Merriweather | Google Fonts CDN |
| Editor: display | Playfair Display | Google Fonts CDN |
| Editor: humanist | Lato | Google Fonts CDN |
| Editor: neo-grotesque | Roboto | Google Fonts CDN |
| Editor: neutral sans | Inter | Google Fonts CDN |

> **Manifesto vs implementation note:** The manifesto specifies Geist Mono for code blocks. The implementation uses JetBrains Mono. JetBrains Mono has superior ligature support and is the current production font.

Tailwind tokens: `--font-sans` resolves to Geist Sans → Inter → system-ui; `--font-mono` resolves to JetBrains Mono.

### Type Scale

Major Third scale (ratio: 1.25) from 16px base:

| Role | Size | Usage |
|---|---|---|
| Display | 32px (2rem) | Hero text, onboarding headings |
| H1 | 36px (text-4xl) | ProseMirror h1 |
| H2 | 24px (text-2xl) | ProseMirror h2 |
| H3 | 20px (text-xl) | ProseMirror h3 |
| Body | 16px (text-base) | Default prose |
| UI Small | 14px (text-sm) | Labels, list items, metadata |
| UI Tiny | 12px (text-xs) | Timestamps, badge counts |

Heading weights: 700 (h1), 600 (h2), 500 (h3). Body: 400. UI labels: 400/500. Letter spacing: `tracking-tight` on headings.

### Line Height

Editor paragraphs: `leading-relaxed` (1.625). UI text: inherits Tailwind defaults. Line height is not animated — only opacity and transform.

---

## Spacing & Layout

All spacing is on an **8px base grid** with a 4px half-step for tight contexts.

```
4px   — icon gap, badge padding, fine-grained internal spacing
8px   — default gap between related elements
12px  — compact card padding, tight row spacing
16px  — standard card padding, section gaps
24px  — major content block gaps
32px  — section-level breathing room
```

Deviating from the grid requires a written reason. Use Tailwind's spacing scale which maps directly: `p-1` = 4px, `p-2` = 8px, `p-3` = 12px, `p-4` = 16px, `p-6` = 24px, `p-8` = 32px.

### Three-Panel Layout

Desktop: Sidebar (nav + folders) | Note list | Editor. Panel widths are user-adjustable via draggable dividers (`ResizeHandle` component), persisted in Zustand.

Mobile: single-panel stack. Panel visibility toggled via `mobileView` state in Zustand.

Breakpoints (from `useBreakpoint()`):

| Range | Label | Layout |
|---|---|---|
| < 768px | mobile | Single panel; sidebar in drawer-left |
| 768–1199px | tablet | Two-panel; sidebar collapsible |
| ≥ 1200px | desktop | Three-panel; draggable dividers |

Minimum supported width: 344px (Galaxy Fold cover screen).

---

## Surface & Depth

Five elevation layers. Depth is conveyed by surface lightness increase, not shadow alone.

| Layer | Token | Lightness | Used for |
|---|---|---|---|
| Base | `--background` | 5% (dark) | Page background |
| Surface 1 | `--panel` | 10% | Sidebar, panels |
| Surface 2 | `--card` | 13% | Note list cards, list items |
| Surface 3 | `--editor` | 20% | Editor content area |
| Elevated | `--popover` | 23% | Dropdowns, modals, tooltips |

In dark mode, each layer also has a `.luminance-border-top` pattern — a 1px inset box-shadow (`rgba(255,255,255,0.05)`) that simulates light catching the top edge of a raised surface. Apply to `bg-popover` elements.

```css
.luminance-border-top {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

In light mode, `.luminance-border-top` renders no shadow — light mode uses standard drop shadows for depth.

### Border Radii

| Value | Token | Used for |
|---|---|---|
| 6px | `rounded` | Tight elements: code inline, checkbox, badges |
| 8px | `rounded-lg` | Buttons, inputs, small cards |
| 12px | `rounded-xl` | Cards, panels, images |
| 16px | `rounded-2xl` | Modals, large panels |
| 9999px | `rounded-full` | Pills, avatar circles, scrollbar thumb |

No sharp corners (0px radius). All interactive elements have at minimum `rounded`.

### Shadows

Tailwind shadow utilities. Dark mode shadows use higher opacity (warm black) to register against dark surfaces. `shadow-md` is standard for floating elements. `shadow-xl` + `shadow-black/30` for modals.

---

## Component Patterns

### Buttons

Three levels of button component:

1. **`<Button>`** — shadcn/ui Button (variant=ghost/default/destructive/outline). Raw action.
2. **`<IconButton>`** — thin wrapper around `<Button variant="ghost">`. Adds `.active-elevate-2` press feedback and enforces minimum 32×32px icon target. Use for toolbar icons and icon-only actions.
3. **`<ToolbarButton>`** — wrapper around shadcn `<Toggle>`. For two-state (on/off) toolbar actions like Bold, Italic.

Do not replace existing `IconButton` or `ToolbarButton` consumers with raw `<Button>` — the wrappers preserve app-specific behavior across ~50 files.

### Modals

Two modal patterns. Choose based on whether the modal needs an exit animation:

**With exit animation** (SettingsModal, AISetupModal, SaveAsTemplateDialog, TemplatePickerModal):
Use raw Radix Dialog primitives with `forceMount` + `AnimatePresence`. Do NOT use `<DialogContent>` from shadcn/ui — it wraps Portal+Overlay in a way that conflicts.

```tsx
import { Dialog as DialogPrimitive } from "radix-ui";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogPrimitive.Portal forceMount>
    <AnimatePresence>
      {open && (
        <>
          <DialogPrimitive.Overlay forceMount asChild>
            <motion.div className="fixed inset-0 bg-black/60" {...overlayAnim} />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content forceMount asChild
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => e.preventDefault()}>
            <motion.div {...contentAnim}>
              {children}
            </motion.div>
          </DialogPrimitive.Content>
        </>
      )}
    </AnimatePresence>
  </DialogPrimitive.Portal>
</Dialog>
```

**Without exit animation** (FolderEditModal, VaultModal, confirmation dialogs):
Use `<Dialog><DialogContent>` from `src/components/ui/dialog.tsx` directly. Simpler.

For confirm/cancel dialogs: always use `<AlertDialog>` (not `<Dialog>`).

### Dropdowns and Popovers

Use `<DropdownMenu>` or `<Popover>` from shadcn/ui. Radix handles positioning, collision detection, Escape, and click-outside automatically — never use `createPortal` + `getBoundingClientRect` + manual listeners.

For popovers whose trigger is in a sibling component (e.g. `ColorPickerDropdown` receiving `triggerRef` from `EditorToolbar`), use `<PopoverAnchor virtualRef={triggerRef as React.RefObject<HTMLElement>} />` to anchor position to an external element.

### ScrollArea in Flex Contexts

Radix `ScrollArea`'s internal Viewport is `size-full` — it expands to its parent's bounded height. When `ScrollArea` is a `flex-1` child of a flex column, add `min-h-0`:

```tsx
<div className="h-screen flex flex-col">
  <header />
  <ScrollArea className="flex-1 min-h-0">  {/* min-h-0 required */}
    <div className="p-2">{children}</div>
  </ScrollArea>
</div>
```

Without `min-h-0`, the flex child doesn't shrink below content size and the scroll never activates.

### Version History Panel

Uses raw Radix Dialog with `modal={isMobile}`. On desktop, the panel slides in without dimming the editor (non-modal). On mobile it becomes a modal bottom sheet.

### Color Picker

`ColorPickerDropdown` uses pending state — color is not applied on every drag/slider change (which would steal editor focus). User commits with OK or discards with Cancel. `<PopoverContent onFocusOutside={(e) => e.preventDefault()}>` prevents the popover from closing when focus moves to the color inputs.

---

## Animation & Motion

### Motion Level System

Three levels set on `<html data-motion="...">` via `useMotionInit()`. The level is persisted to `localStorage`.

| Level | CSS durations | Framer Motion behavior |
|---|---|---|
| `full` | micro 100ms, fast 160ms, standard 220ms | Springs, scale, y-offset enter/exit |
| `reduced` | micro 50ms, fast 80ms, standard 110ms | Opacity-only, easeOut, no springs |
| `minimal` | all 100ms | Opacity-only, linear, no transform |

`minimal` does not mean "instant" — it means "no motion beyond opacity". Durations are kept at 100ms so interactive feedback (hover, press) still feels alive. It is NOT 0ms.

### CSS Motion Tokens

```css
--motion-duration-micro:    var(--duration-micro)    /* 100ms full */
--motion-duration-fast:     var(--duration-fast)     /* 160ms full */
--motion-duration-standard: var(--duration-standard) /* 220ms full */
```

Always use these tokens in CSS transitions (`transition-duration: var(--motion-duration-fast)`). Do not hardcode millisecond values in CSS.

### Framer Motion: `useAnimationConfig()`

All Framer Motion components must use `useAnimationConfig()` from `hooks/use-motion.ts`. Never hardcode duration or easing values in components.

```tsx
const anim = useAnimationConfig();

<motion.div
  initial={anim.initialVariants}
  animate={anim.enterVariants}
  exit={anim.exitVariants}
  transition={anim.fastTransition}
/>
```

Key configs from `useAnimationConfig()`:

| Config | Full | Reduced | Minimal |
|---|---|---|---|
| `fastTransition` | 160ms ease-out-expo | 80ms easeOut | 100ms linear |
| `spring` | spring stiffness 300 / damping 22 | 150ms easeOut tween | 100ms linear |
| `initialVariants` | `{opacity:0, y:4, scale:0.97}` | `{opacity:0}` | `{opacity:0}` |
| `exitVariants` | `{opacity:0, x:-8, scale:0.97}` | `{opacity:0}` | `{opacity:0}` |
| `cardExitVariants` | `{opacity:0, scaleY:0}` (top-anchored) | `{opacity:0}` | `{opacity:0}` |

### Easing Values

```
Spring easing:    cubic-bezier(0.34, 1.56, 0.64, 1)  — bouncy, physical
Ease-out expo:    cubic-bezier(0.16, 1, 0.3, 1)       — fast start, soft landing
Standard:         cubic-bezier(0.4, 0, 0.2, 1)         — material-standard
Exit:             cubic-bezier(0.4, 0, 1, 1)            — accelerate into exit
```

### .active-elevate-2

Press feedback class applied to all `IconButton` and `ToolbarButton` elements (and `Button` at the shadcn level). Behavior by motion level:

- `full`: `scale(0.97)` on `:active`, 80ms ease-out
- `reduced`: `scale(0.98)` on `:active`
- `minimal`: no transform, color/bg transition only

### Framer Motion Rules

- Never use `layout` prop on list items — it triggers layout measurement on every render and causes jank on lists of 50+ notes
- Never animate `width`, `height`, `top`, `left`, `margin`, `padding` — these trigger layout recalculation on every frame
- Always animate `transform` (translateX/Y/scale) and `opacity` — GPU-composited, no layout or paint cost
- CSS transitions first; Framer Motion only for springs, gestures, or layout animations CSS cannot express

---

## Icons

Lucide React icons. Sizing conventions:

| Context | Size | Notes |
|---|---|---|
| Toolbar icons | 16px (`size-4`) | `IconButton` / `ToolbarButton` |
| Sidebar nav icons | 18px (`size-[18px]`) | Nav items |
| List item icons | 16px | Note card actions |
| Empty state icons | 40–48px | Centered in empty panels |
| Inline in text | 14px (`size-3.5`) | Tags, badges |

Icon color behavior: `text-muted-foreground` at rest, `text-foreground` on hover/active. Never solid black or white — always token-based so icons respond to dark/light mode correctly.

---

## Responsive Behavior

The `useBreakpoint()` hook from `src/hooks/use-mobile.tsx` returns `"mobile" | "tablet" | "desktop"`. Thresholds: mobile < 768px, tablet 768–1199px, desktop ≥ 1200px.

| Width | Layout behavior |
|---|---|
| 344px | Galaxy Fold cover — minimum supported; all content must fit |
| < 600px | Single panel; bottom nav; 75% desktop spacing; 44px touch targets |
| 600–768px | Single panel with sheet overlays |
| 768–1024px | Two-panel; sidebar collapsible via drawer |
| > 1024px | Three-panel; draggable dividers |

Test at all four widths (390px, 768px, 1024px, 1280px) when adding new UI.

---

## Touch & Input

- Minimum touch target: **44×44px** on touch devices. Hard floor from Apple HIG.
- **Never gate functionality behind hover.** Every action reachable via hover must be reachable by tap or keyboard.
- Hover effects on touch devices should either not appear or translate to active/pressed states.
- iPad supports keyboard + trackpad + touch simultaneously — test all three.
- Long-press on touch = right-click on pointer for context menus.
- `ProseMirror` has `-webkit-touch-callout: none` to suppress iOS's native long-press callout. The `MobileSelectionMenu` provides a custom replacement with cut/copy/paste/AI tools.

---

## Dark Mode Implementation

Dark mode is applied via CSS class on `<html>`:
- Dark modes: no class (default dark) with optional `data-dark-level` attribute
- Light mode: `.light` class

The `useAtmosphere()` hook from `src/hooks/use-atmosphere.ts` sets both `data-dark-level` (soft/default/oled) and `data-colorblind` (none/protanopia/tritanopia) on `<html>`. Preferences are read from and written to `localStorage`.

`next-themes` handles SSR/hydration of the theme class to prevent flash.

---

## Things to Avoid

- **Sharp corners** — no `rounded-none` on visible UI elements
- **Hard-coded color values** in components — always use Tailwind color utilities that resolve to CSS variables
- **Animating layout properties** — width, height, top, left, margin, padding trigger layout recalculation
- **Using `layout` prop on list items** in Framer Motion
- **Hardcoded motion durations** in components — use `useAnimationConfig()` or CSS tokens
- **Hover-only interactions** — must also be accessible by tap
- **Gating actions behind long-press** on desktop (where there is no touch)
- **Using `createPortal` + manual positioning** for menus/popovers — use Radix primitives
- **More accent ≠ better** — one accent element per view is the target; accent on every header and button is visual noise

---

## Design Verification Checklist

Before submitting any PR with UI changes:

- [ ] All spacing is on the 8px grid (or 4px half-step where justified)
- [ ] Border radii follow the 6/8/12/16/9999px set — no sharp corners, no arbitrary values
- [ ] All interactive elements have min 44×44px touch target on mobile
- [ ] No functionality gated behind hover
- [ ] All colors use CSS variable tokens — no hardcoded hex/rgb/hsl in JSX
- [ ] Accent color used sparingly — not applied to every header or decorative element
- [ ] Motion respects motion level — all Framer Motion uses `useAnimationConfig()`
- [ ] Tested at 390px, 768px, 1280px widths
- [ ] Tested in both dark and light mode
- [ ] Tested in Safari/WebKit (iOS or desktop Safari)
- [ ] `.luminance-border-top` applied to new `bg-popover` surfaces in dark mode

---

## Gaps: Manifesto vs Implementation

The following manifesto features are documented but not yet implemented:

| Feature | Manifesto status | Implementation status |
|---|---|---|
| Accent color presets (Spring, Midnight, Ember) | Specified in §2.3 | Not implemented; single accent (#5B93E8) hardcoded |
| Per-note editor font selection | Mentioned | System-wide font picker only |
| Content width toggle (700/900/full) | Specified | Not implemented |
| `lib/design-tokens.ts` | Specified as source of truth | Tokens are CSS vars in globals.css instead |
| Canvas / spreadsheet / drawing note types | Roadmap | Not implemented |
| Toolbar personality moments (paint bucket tilt, link jiggle) | Specified in §6.4 | Unknown implementation status |
| Geist Mono for code blocks | Specified in §3 | JetBrains Mono used instead |
| Self-hosting all fonts | Specified | Google CDN for JetBrains Mono and editor fonts |
