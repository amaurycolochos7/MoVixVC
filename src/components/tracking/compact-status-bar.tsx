"use client";

import { CheckCircle, Loader2 } from "lucide-react";

interface StatusStep {
    id: string;
    label: string;
}

const STEPS: StatusStep[] = [
    { id: "accepted", label: "Aceptado" },
    { id: "on_the_way", label: "En camino" },
    { id: "nearby", label: "Cerca" },
    { id: "arrived", label: "Llegó" },
    { id: "picked_up", label: "A bordo" },
    { id: "in_transit", label: "En destino" },
];

interface CompactStatusBarProps {
    currentStep: string | null;
}

/**
 * Compact single-line status bar showing current trip step
 * Replaces the verbose 6-step timeline
 */
export function CompactStatusBar({ currentStep }: CompactStatusBarProps) {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    const current = STEPS[currentIndex] || STEPS[0];
    const progress = ((currentIndex + 1) / STEPS.length) * 100;

    return (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Status text */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {currentIndex === STEPS.length - 1 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    <span className="font-semibold text-sm">{current.label}</span>
                </div>
                <span className="text-xs text-gray-500">
                    Paso {currentIndex + 1} de {STEPS.length}
                </span>
            </div>
        </div>
    );
}
