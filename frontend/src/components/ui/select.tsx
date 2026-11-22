"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-10 w-fit items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm whitespace-nowrap shadow-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground">v</SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={4} className="isolate z-50 outline-none">
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative z-50 min-w-36 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List className="p-1">{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-lg px-2 py-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem }
