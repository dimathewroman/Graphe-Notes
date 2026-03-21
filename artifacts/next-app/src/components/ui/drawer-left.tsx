import * as React from "react"
import { Drawer as VaulDrawer } from "vaul"
import { cn } from "@/lib/utils"

const DrawerPrimitive = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content>
>(({ className, children, ...props }, ref) => (
  <VaulDrawer.Content
    ref={ref}
    aria-describedby={undefined}
    className={cn(className)}
    {...props}
  >
    <VaulDrawer.Title className="sr-only">Navigation</VaulDrawer.Title>
    {children}
  </VaulDrawer.Content>
))
DrawerPrimitive.displayName = "DrawerPrimitive"

export { DrawerPrimitive }
