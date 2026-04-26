import * as React from "react"

const MOBILE_BREAKPOINT = 768
// Bumped from 1024 to 1200 so iPad Pro 12.9"/13" in portrait orientation
// (1024–1032px wide) gets the 2-column tablet layout instead of falling
// into the 3-column desktop layout, where the columns end up too narrow
// to read titles or use the editor comfortably. Most laptops are ≥1280
// so this doesn't change desktop behavior on real Mac/PC screens.
const TABLET_BREAKPOINT = 1200

// iPad/iPadOS detection. Modern iPads report as "MacIntel" in UA but expose
// touch points; legacy iPads/iPhones include their name in the UA string.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ desktop-class UA: report as Mac but with touch support.
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
}

export function useBreakpoint() {
  const [bp, setBp] = React.useState<"mobile" | "tablet" | "desktop">("desktop")

  React.useEffect(() => {
    const onIOS = isIOS();
    const check = () => {
      // iPad Safari intermittently reports `window.innerWidth` smaller than
      // the actual viewport during in-page layout events (e.g. our drawer
      // opening on tablet/desktop), which made bp flip across the 1200px
      // desktop threshold every time the sidebar toggled. `screen.availWidth`
      // reflects the device's actual usable viewport and stays constant
      // unless the user really rotates or enters split view, so we use it
      // as a floor on iOS — never let bp report smaller than the real
      // device width.
      const w = onIOS
        ? Math.max(screen.availWidth || 0, window.innerWidth)
        : window.innerWidth
      if (w < MOBILE_BREAKPOINT) setBp("mobile")
      else if (w < TABLET_BREAKPOINT) setBp("tablet")
      else setBp("desktop")
    }
    check()
    window.addEventListener("resize", check)
    // iPad screen.availWidth changes on orientation; orientationchange is
    // fired before resize on some Safari versions, so listen to both.
    window.addEventListener("orientationchange", check)
    return () => {
      window.removeEventListener("resize", check)
      window.removeEventListener("orientationchange", check)
    }
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
