"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface BottomNavItemProps {
    icon: LucideIcon;
    label: string;
    href: string;
}

interface BottomNavProps {
    items: BottomNavItemProps[];
}

export function BottomNav({ items }: BottomNavProps) {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface bg-white dark:bg-gray-900 pb-[env(safe-area-inset-bottom)] shadow-lg">
            <div className="grid h-[4.5rem] w-full grid-flow-col items-center">
                {items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1.5 py-1 text-[10px] font-medium transition-colors",
                                isActive
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            )}
                        >
                            <item.icon
                                className={cn("h-6 w-6", isActive ? "stroke-[2.5px]" : "stroke-2")}
                            />
                            <span className="truncate max-w-[4.5rem]">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
