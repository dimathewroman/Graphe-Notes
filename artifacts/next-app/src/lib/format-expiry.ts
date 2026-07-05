// Shared Quick Bit expiry formatter (R7). Previously copy-pasted verbatim in
// QuickBitList, QuickBitNotifications, and QuickBitShell. Returns a human label
// plus a semantic className: destructive for <24h urgency, warning for <48h, muted
// otherwise. `emphasize` adds font-medium (list/shell rows) — Notifications passes
// false for its lighter treatment.
export function formatExpiry(
  expiresAt: string | Date,
  opts?: { emphasize?: boolean },
): { label: string; className: string } {
  const urgent = opts?.emphasize === false ? "text-destructive" : "text-destructive font-medium";
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  const totalMinutes = msLeft / (1000 * 60);
  const totalHours = msLeft / (1000 * 60 * 60);

  if (msLeft <= 0) return { label: "Expired", className: urgent };
  if (totalHours < 1) {
    const m = Math.ceil(totalMinutes);
    return { label: `${m} minute${m !== 1 ? "s" : ""} left`, className: urgent };
  }
  if (totalHours < 24) {
    const h = Math.ceil(totalHours);
    return { label: `${h} hour${h !== 1 ? "s" : ""} left`, className: urgent };
  }
  const d = Math.ceil(totalHours / 24);
  const className = totalHours < 48 ? "text-warning" : "text-muted-foreground/70";
  return { label: `${d} day${d !== 1 ? "s" : ""} left`, className };
}
