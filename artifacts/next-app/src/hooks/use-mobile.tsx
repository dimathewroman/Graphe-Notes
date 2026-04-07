import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export function useBreakpoint() {
  const [bp, setBp] = React.useState<"mobile" | "tablet" | "desktop">("desktop")

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      if (w < MOBILE_BREAKPOINT) setBp("mobile")
      else if (w < TABLET_BREAKPOINT) setBp("tablet")
      else setBp("desktop")
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  return bp
}

// Returns the inset (in CSS px) from the bottom of the layout viewport to the
// bottom of the currently visible area. When a soft keyboard is open this is
// the keyboard height; when nothing is overlaying the page it is 0.
//
// The formula `innerHeight - vv.height - vv.offsetTop` works across:
//   - iOS Safari (layout viewport stays full-size; visual viewport shrinks)
//   - Android Chrome with `interactive-widget=resizes-visual` (the modern
//     default since Chromium 108 — same behavior as iOS)
//   - Android Chrome with `interactive-widget=resizes-content` (legacy:
//     layout viewport itself shrinks, so the inset stays at 0 and the toolbar
//     uses bottom: 0 directly)
//
// `vv.offsetTop` matters because Android Chrome auto-scrolls the visual
// viewport inside the layout viewport when an input near the bottom of the
// page receives focus. Without subtracting it the toolbar drifts upward by
// however much the visual viewport has scrolled.
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = React.useState(0)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const inset = window.innerHeight - vv.height - vv.offsetTop
      // Threshold filters out a few pixels of browser-chrome rounding so a
      // closed keyboard reads as exactly 0.
      setKeyboardHeight(inset > 50 ? inset : 0)
    }

    update()
    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    // Catches Android Chrome `resizes-content` where window.innerHeight
    // changes but visualViewport events may not fire.
    window.addEventListener("resize", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return keyboardHeight
}
