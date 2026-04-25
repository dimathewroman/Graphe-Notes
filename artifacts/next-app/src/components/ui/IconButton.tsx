import * as React from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface IconButtonProps extends Omit<React.ComponentProps<"button">, "ref"> {
  active?: boolean;
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn(
          "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-2 rounded-md",
          "transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-expo)]",
          "text-muted-foreground hover:text-foreground hover:bg-panel-hover hover:scale-[1.08] active:scale-[0.95]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          active && "bg-panel-hover text-primary",
          className
        )}
        {...props}
      />
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
