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

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = React.useState(0)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const diff = window.innerHeight - vv.height
      setKeyboardHeight(diff > 50 ? diff : 0)
    }

    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [])

  return keyboardHeight
}
