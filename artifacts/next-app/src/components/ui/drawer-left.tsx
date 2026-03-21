import * as React from "react"
import { Drawer as VaulDrawer } from "vaul"
import { cn } from "@/lib/utils"

const DrawerPrimitive = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content>
>(({ className, children, ...props }, ref) => (
  <VaulDrawer.Content
    ref={ref}
    className={cn(className)}
    {...props}
  >
    {children}
  </VaulDrawer.Content>
))
DrawerPrimitive.displayName = "DrawerPrimitive"

export { DrawerPrimitive }
