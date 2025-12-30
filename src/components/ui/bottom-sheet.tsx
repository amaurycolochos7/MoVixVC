"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

/* Re-using Dialog primitives but creating a separate Sheet abstraction 
   specifically for Bottom Sheet behavior on mobile */

const BottomSheet = DialogPrimitive.Root
const BottomSheetTrigger = DialogPrimitive.Trigger
const BottomSheetClose = DialogPrimitive.Close
const BottomSheetPortal = DialogPrimitive.Portal

const BottomSheetOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className
        )}
        {...props}
    />
))
BottomSheetOverlay.displayName = "BottomSheetOverlay"

const BottomSheetContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <BottomSheetPortal>
        <BottomSheetOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed inset-x-0 bottom-0 z-50 flex flex-col gap-4 rounded-t-3xl border-t border-border bg-surface p-6 shadow-lg transition duration-200 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full",
                className
            )}
            {...props}
        >
            <div className="mx-auto h-1 w-12 shrink-0 rounded-full bg-border" />
            {children}
        </DialogPrimitive.Content>
    </BottomSheetPortal>
))
BottomSheetContent.displayName = "BottomSheetContent"

const BottomSheetHeader = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
        {...props}
    />
)
BottomSheetHeader.displayName = "BottomSheetHeader"

const BottomSheetTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold text-text-primary", className)}
        {...props}
    />
))
BottomSheetTitle.displayName = "BottomSheetTitle"

const BottomSheetDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-text-secondary", className)}
        {...props}
    />
))
BottomSheetDescription.displayName = "BottomSheetDescription"

export {
    BottomSheet,
    BottomSheetTrigger,
    BottomSheetClose,
    BottomSheetContent,
    BottomSheetHeader,
    BottomSheetTitle,
    BottomSheetDescription,
}
