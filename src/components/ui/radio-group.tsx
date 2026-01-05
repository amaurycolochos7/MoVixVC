"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: string; onValueChange?: (value: string) => void }
>(({ className, value, onValueChange, children, ...props }, ref) => {
    // Simple context or just pass props down if we were using context, 
    // but for a simple implementation without context, we might need a different approach 
    // or just rely on the children being RadioGroupItem and passing props manually if this was specific.
    // However, specifically for the usage in CancellationModal, we can just use a simple Context.

    return (
        <RadioGroupContext.Provider value={{ value, onValueChange }}>
            <div className={cn("grid gap-2", className)} ref={ref} {...props}>
                {children}
            </div>
        </RadioGroupContext.Provider>
    )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
} | undefined>(undefined)

const RadioGroupItem = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext)
    const isSelected = context?.value === value

    return (
        <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-state={isSelected ? "checked" : "unchecked"}
            value={value}
            ref={ref}
            className={cn(
                "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                isSelected && "bg-primary text-primary-foreground", // Simple fill for checked
                className
            )}
            onClick={() => context?.onValueChange?.(value)}
            {...props}
        >
            <span className={cn("flex items-center justify-center pointer-events-none", isSelected ? "opacity-100" : "opacity-0")}>
                <svg
                    width="6"
                    height="6"
                    viewBox="0 0 6 6"
                    fill="currentcolor"
                    xmlns="http://www.w3.org/2000/svg"
                    className="fill-current text-white"
                >
                    <circle cx="3" cy="3" r="3" />
                </svg>
            </span>
        </button>
    )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
