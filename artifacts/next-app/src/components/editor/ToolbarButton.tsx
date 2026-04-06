// Atomic icon button used throughout the editor toolbar.

import { cn } from "@/lib/utils";

export function ToolbarButton({
  command,
  active,
  icon,
  title,
  disabled,
}: {
  command: () => void;
  active: boolean;
  icon: React.ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={command}
      title={title}
      disabled={disabled}
      className={cn(
        "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded-md text-muted-foreground hover:bg-panel hover:text-foreground shrink-0 flex items-center justify-center",
        "transition-all duration-[var(--duration-micro)] ease-[var(--ease-out-expo)] hover:scale-[1.08] active:scale-[0.95]",
        active && "bg-panel text-primary",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none hover:scale-100"
      )}
    >
      {icon}
    </button>
  );
}
