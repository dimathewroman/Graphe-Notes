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
        "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-1.5 rounded text-muted-foreground hover:bg-panel hover:text-foreground transition-colors shrink-0 flex items-center justify-center",
        active && "bg-panel text-primary",
        disabled && "opacity-30 cursor-not-allowed pointer-events-none"
      )}
    >
      {icon}
    </button>
  );
}
