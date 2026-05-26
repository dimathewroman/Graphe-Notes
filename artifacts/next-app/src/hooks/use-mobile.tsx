import * as React from "react"

const MOBILE_BREAKPOINT = 768
// Bumped from 1024 to 1200 so iPad Pro 12.9"/13" in portrait orientation
// (1024–1032px wide) gets the 2-column tablet layout instead of falling
// into the 3-column desktop layout, where the columns end up too narrow
// to read titles or use the editor comfortably. Most laptops are ≥1280
// so this doesn't change desktop behavior on real Mac/PC screens.
const TABLET_BREAKPOINT = 1200

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

// Returns the keyboard height (in CSS px). When a soft keyboard is open this
// is the height of the keyboard; when nothing overlays the page it is 0.
//
// Formula: `innerHeight - vv.height`
//   - iOS Safari: layout viewport stays full-size; visual viewport shrinks by
//     keyboard height. innerH - vv.h = keyboard height. ✓
//   - Android Chrome with `interactive-widget=resizes-visual`: same as iOS.
//     The keyboard height is the difference between the stable layout viewport
//     and the shrinking visual viewport. vv.offsetTop (document scroll) must
//     NOT be subtracted — it reflects the page scrolling to show the cursor,
//     not the keyboard size. Subtracting it causes the toolbar to drift into
//     the keyboard when the user taps mid-document.
//   - Android Chrome `resizes-content` (legacy): layout viewport shrinks too,
//     so innerH ≈ vv.h and the result is ~0 → toolbar uses bottom: 0 directly.
export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = React.useState(0)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const inset = window.innerHeight - vv.height
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
