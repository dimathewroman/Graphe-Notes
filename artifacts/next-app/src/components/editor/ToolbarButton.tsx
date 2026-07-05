import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export function ToolbarButton({
  command,
  active,
  icon,
  title,
  disabled,
  testId,
}: {
  command: () => void;
  active: boolean;
  icon: React.ReactNode;
  title?: string;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <Toggle
      pressed={active}
      onPressedChange={() => command()}
      title={title}
      disabled={disabled}
      size="sm"
      data-testid={testId}
      className={cn(
        // Touch targets gate on pointer type, not viewport width (coarse = 44px HIG min).
        "min-w-0 min-h-0 p-1.5 coarse:min-w-[44px] coarse:min-h-[44px] coarse:p-2.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground shrink-0",
        "transition-all duration-[var(--duration-micro)] ease-[var(--ease-out-expo)] hover:scale-[1.08] active:scale-[0.95]",
        "data-[state=on]:bg-primary/10 data-[state=on]:text-primary",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none hover:scale-100"
      )}
    >
      {icon}
    </Toggle>
  );
}
