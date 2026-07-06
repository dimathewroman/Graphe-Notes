import { NotificationCadenceEditor } from "../NotificationCadenceEditor";
import { cn } from "@/lib/utils";

export function QuickBitsSettingsTab({
  expirationDays,
  setExpirationDays,
  notificationHours,
  setNotificationHours,
}: {
  expirationDays: number;
  setExpirationDays: (days: number) => void;
  notificationHours: number[];
  setNotificationHours: (hours: number[]) => void;
}) {
  return (
    <>
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default Expiration</h3>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 5, 7].map((days) => (
            <button
              key={days}
              onClick={() => setExpirationDays(days)}
              className={cn(
                "flex-1 min-w-[52px] py-2 rounded-xl border text-sm font-medium transition-all",
                expirationDays === days
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-panel-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {days === 1 ? "1 day" : `${days} days`}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default Notifications</h3>
        <NotificationCadenceEditor value={notificationHours} onChange={setNotificationHours} />
      </section>
    </>
  );
}
