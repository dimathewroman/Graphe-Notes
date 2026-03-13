import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, active, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2.5 md:p-2 rounded-lg flex items-center justify-center transition-all duration-200",
          "text-muted-foreground hover:text-foreground hover:bg-panel-hover",
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
