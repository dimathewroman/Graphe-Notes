import { useEffect, useRef } from "react";
import { useAppStore } from "@/store";
import { useBreakpoint } from "@/hooks/use-mobile";

/**
 * M2: mirror the mobile `list ↔ editor` view into the browser history so the
 * hardware/browser Back button returns to the list instead of exiting the app
 * (potentially mid-edit).
 *
 * Both paths converge on `popstate`:
 *  - entering the editor pushes a history entry;
 *  - Back (hardware or browser) pops it → we drop back to the list;
 *  - leaving the editor via in-app UI consumes our entry with history.back().
 *
 * A Capacitor `App.backButton` listener can drive the same behavior by calling
 * `window.history.back()`, which routes through the popstate handler below.
 */
export function useMobileHistoryNav() {
  const bp = useBreakpoint();
  const mobileView = useAppStore((s) => s.mobileView);

  // Whether we currently own a pushed "editor" history entry.
  const pushedRef = useRef(false);
  // Guards the popstate fired by our own cleanup history.back().
  const selfBackRef = useRef(false);

  useEffect(() => {
    if (bp !== "mobile") {
      pushedRef.current = false;
      return;
    }
    if (mobileView === "editor" && !pushedRef.current) {
      window.history.pushState({ grapheMobileView: "editor" }, "");
      pushedRef.current = true;
    } else if (mobileView === "list" && pushedRef.current) {
      // Left the editor via in-app UI (e.g. the header back button) — consume
      // our history entry so a later hardware Back doesn't skip past it and exit.
      pushedRef.current = false;
      selfBackRef.current = true;
      window.history.back();
    }
  }, [mobileView, bp]);

  useEffect(() => {
    const onPopState = () => {
      if (selfBackRef.current) {
        selfBackRef.current = false;
        return;
      }
      const state = useAppStore.getState();
      if (state.mobileView === "editor") {
        pushedRef.current = false;
        state.setMobileView("list");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
