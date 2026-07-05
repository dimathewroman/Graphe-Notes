import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const toggle = (
    <Toggle
      pressed={active}
      onPressedChange={() => command()}
      disabled={disabled}
      size="sm"
      data-testid={testId}
      // No native `title` — the Radix tooltip below is the accessible label so we
      // don't render two overlapping tooltips. aria-label keeps the name for AT.
      aria-label={title}
      className={cn(
        // Touch targets gate on pointer type, not viewport width (coarse = 44px HIG min).
        "min-w-0 min-h-0 p-1.5 coarse:min-w-[44px] coarse:min-h-[44px] coarse:p-2.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground shrink-0",
        // D6: tactile-scale is motion-level-gated in globals.css (no transform at minimal).
        "transition-all duration-[var(--motion-duration-micro)] ease-[var(--ease-out-expo)] tactile-scale",
        "data-[state=on]:bg-primary/10 data-[state=on]:text-primary",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none"
      )}
    >
      {icon}
    </Toggle>
  );

  // ToolbarButton is a leaf command button (never an asChild Radix trigger), so it's
  // safe to wrap centrally in a tooltip — this replaces the native title= across the
  // whole toolbar. Radix suppresses tooltips on touch, so taps are unaffected.
  if (!title) return toggle;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{toggle}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}
