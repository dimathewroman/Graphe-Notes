// Dev-only Claude-proxy routing. When the local proxy (scripts/claude-proxy.mjs)
// is running, AI actions can auto-route through it — handy for testing while a
// real provider (Graphe free tier, BYOK) is rate-limited or unconfigured. The
// whole feature is gated behind NEXT_PUBLIC_ENABLE_CLAUDE_PROXY (dev/CI only);
// in production the flag is unset, so every export here no-ops and nothing routes
// to or renders the proxy. Selection is client-side and never persisted to the
// account's active provider — it's an override layer, freely switchable.
import { useEffect } from "react";
import { useAppStore, type ClaudeAiRouting } from "@/store";

// Where the proxy listens. Overridable for a non-default port, but defaults to
// the value scripts/claude-proxy.mjs prints.
export const CLAUDE_PROXY_URL = (process.env.NEXT_PUBLIC_CLAUDE_PROXY_URL || "http://localhost:8788").replace(/\/+$/, "");

// Claude models the proxy advertises / the CLI accepts as `--model` aliases.
export const CLAUDE_PROXY_MODELS = ["sonnet", "opus", "haiku"] as const;

const ROUTING_KEY = "claude_ai_routing";
const MODEL_KEY = "claude_proxy_model";

/** The dev/CI-only master switch. Unset in production ⇒ the feature is inert. */
export function isClaudeProxyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CLAUDE_PROXY === "1";
}

/**
 * Pure routing decision: should this request go through the proxy?
 * - "account" → never (use the account's Graphe-free / BYOK provider)
 * - "proxy"   → always (even if the probe hasn't confirmed it yet)
 * - "auto"    → only when the proxy is currently reachable
 * Always false when the feature flag is off.
 */
export function shouldUseProxy(routing: ClaudeAiRouting, available: boolean): boolean {
  if (!isClaudeProxyEnabled()) return false;
  if (routing === "account") return false;
  if (routing === "proxy") return true;
  return available; // "auto"
}

async function probeProxy(): Promise<boolean> {
  try {
    const r = await fetch(`${CLAUDE_PROXY_URL}/v1/models`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * App-root init (flag-gated): restore the saved routing/model, then poll the
 * proxy so "auto" flips the moment it comes up or goes down. Call once, high in
 * the tree (Providers).
 */
export function useClaudeProxyInit(): void {
  const setAvailable = useAppStore((s) => s.setClaudeProxyAvailable);
  const setRouting = useAppStore((s) => s.setClaudeAiRouting);
  const setModel = useAppStore((s) => s.setClaudeProxyModel);

  useEffect(() => {
    if (!isClaudeProxyEnabled()) return;

    const savedRouting = localStorage.getItem(ROUTING_KEY);
    if (savedRouting === "auto" || savedRouting === "proxy" || savedRouting === "account") setRouting(savedRouting);
    const savedModel = localStorage.getItem(MODEL_KEY);
    if (savedModel) setModel(savedModel);

    let cancelled = false;
    const tick = async () => {
      const ok = await probeProxy();
      if (!cancelled) setAvailable(ok);
    };
    tick();
    const id = setInterval(tick, 10_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [setAvailable, setRouting, setModel]);
}

/** Setter that persists the routing choice (localStorage) alongside the store. */
export function useSetClaudeAiRouting(): (r: ClaudeAiRouting) => void {
  const set = useAppStore((s) => s.setClaudeAiRouting);
  return (r) => {
    try { localStorage.setItem(ROUTING_KEY, r); } catch { /* ignore */ }
    set(r);
  };
}

/** Setter that persists the proxy model choice. */
export function useSetClaudeProxyModel(): (m: string) => void {
  const set = useAppStore((s) => s.setClaudeProxyModel);
  return (m) => {
    try { localStorage.setItem(MODEL_KEY, m); } catch { /* ignore */ }
    set(m);
  };
}
