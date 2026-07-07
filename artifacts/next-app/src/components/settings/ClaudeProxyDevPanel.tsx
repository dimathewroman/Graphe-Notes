"use client";

// Dev-only control for routing AI through the local Claude proxy
// (scripts/claude-proxy.mjs). Renders nothing unless NEXT_PUBLIC_ENABLE_CLAUDE_PROXY
// is set, so it's invisible in production. Selection is a client-side override —
// it never changes the account's saved provider, so you can flip between the
// proxy and your real provider (Graphe free / BYOK) freely.
import { useAppStore, type ClaudeAiRouting } from "@/store";
import { cn } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import {
  isClaudeProxyEnabled,
  CLAUDE_PROXY_URL,
  CLAUDE_PROXY_MODELS,
  useSetClaudeAiRouting,
  useSetClaudeProxyModel,
} from "@/hooks/use-claude-proxy";

const OPTIONS: { id: ClaudeAiRouting; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Proxy when running" },
  { id: "proxy", label: "Claude proxy", hint: "Always the proxy" },
  { id: "account", label: "My provider", hint: "Graphe free / BYOK" },
];

export function ClaudeProxyDevPanel() {
  const routing = useAppStore((s) => s.claudeAiRouting);
  const model = useAppStore((s) => s.claudeProxyModel);
  const available = useAppStore((s) => s.claudeProxyAvailable);
  const setRouting = useSetClaudeAiRouting();
  const setModel = useSetClaudeProxyModel();

  if (!isClaudeProxyEnabled()) return null;

  const proxyActive = routing === "proxy" || (routing === "auto" && available);
  const host = CLAUDE_PROXY_URL.replace(/^https?:\/\//, "");

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Dev · Claude proxy
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2 rounded-full", available ? "bg-green-500" : "bg-muted-foreground/40")} />
          {available ? `running · ${host}` : "not detected"}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Route AI through a local Claude proxy for dev testing — overrides your provider without touching account settings.
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setRouting(o.id)}
            aria-pressed={routing === o.id}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-left transition-colors",
              routing === o.id ? "border-amber-500 bg-amber-500/10" : "border-border hover:bg-muted/50",
            )}
          >
            <div className="text-sm font-medium">{o.label}</div>
            <div className="text-[11px] leading-tight text-muted-foreground">{o.hint}</div>
          </button>
        ))}
      </div>

      {routing !== "account" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Model</label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLAUDE_PROXY_MODELS.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {routing === "proxy" && !available && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">start it: pnpm claude-proxy</span>
          )}
        </div>
      )}

      {proxyActive && (
        <div className="text-[11px] text-green-600 dark:text-green-500">
          ✓ AI actions are routing through the proxy ({model}).
        </div>
      )}
    </div>
  );
}
