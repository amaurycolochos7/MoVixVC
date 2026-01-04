"use client";

import { useEffect, useState } from "react";

interface TripAnimationProps {
    currentStep: string | null;
}

/**
 * Professional trip progress with SVG icons only - no emojis
 */
export function TripAnimation({ currentStep }: TripAnimationProps) {
    const [animatedProgress, setAnimatedProgress] = useState(0);

    const getProgress = () => {
        switch (currentStep) {
            case "accepted": return { phase: 1, progress: 15 };
            case "on_the_way": return { phase: 1, progress: 40 };
            case "nearby": return { phase: 1, progress: 75 };
            case "arrived": return { phase: 1, progress: 100 };
            case "picked_up": return { phase: 2, progress: 40 };
            case "in_transit": return { phase: 2, progress: 100 };
            default: return { phase: 1, progress: 5 };
        }
    };

    const { phase, progress } = getProgress();
    const isPickingUp = phase === 1;

    useEffect(() => {
        const timer = setTimeout(() => {
            setAnimatedProgress(progress);
        }, 100);
        return () => clearTimeout(timer);
    }, [progress]);

    const getStepInfo = () => {
        switch (currentStep) {
            case "accepted": return { title: "Conductor asignado", subtitle: "Tu conductor va en camino" };
            case "on_the_way": return { title: "En camino", subtitle: "Llegará pronto" };
            case "nearby": return { title: "Muy cerca", subtitle: "Menos de 1 minuto" };
            case "arrived": return { title: "¡Ha llegado!", subtitle: "Tu conductor te espera" };
            case "picked_up": return { title: "En viaje", subtitle: "Rumbo a tu destino" };
            case "in_transit": return { title: "Llegando", subtitle: "Casi llegas" };
            default: return { title: "Buscando", subtitle: "Conectando..." };
        }
    };

    const stepInfo = getStepInfo();

    // SVG Icons
    const CarIcon = () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
    );

    const PersonIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="8" r="4" />
            <path d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" />
        </svg>
    );

    const HomeIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
    );

    const LocationIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
    );

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Map Area */}
            <div className="relative h-28 bg-gradient-to-br from-gray-50 to-white overflow-hidden">
                {/* Subtle background pattern */}
                <div className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                        backgroundSize: '16px 16px'
                    }}
                />

                {/* Route line */}
                <div className="absolute inset-x-14 top-1/2 -translate-y-1/2">
                    <div className="h-1 bg-gray-200 rounded-full" />
                    <div
                        className="absolute top-0 left-0 h-1 bg-green-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${animatedProgress}%` }}
                    />
                </div>

                {/* Origin marker */}
                <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-md text-white">
                        <LocationIcon />
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 font-medium">
                        {isPickingUp ? "Chofer" : "Inicio"}
                    </span>
                </div>

                {/* Car - SVG only */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 transition-all duration-1000 ease-out"
                    style={{ left: `calc(56px + ${animatedProgress}% * 0.58)` }}
                >
                    <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-gray-900 flex items-center justify-center shadow-xl text-white">
                            <CarIcon />
                        </div>
                        {/* Live indicator */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white">
                            <div className="w-full h-full rounded-full bg-green-400 animate-ping" />
                        </div>
                    </div>
                </div>

                {/* Destination marker */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-colors text-white ${animatedProgress >= 95 ? 'bg-green-500' : 'bg-orange-500'
                        }`}>
                        {isPickingUp ? <PersonIcon /> : <HomeIcon />}
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 font-medium">
                        {isPickingUp ? "Tú" : "Destino"}
                    </span>
                </div>
            </div>

            {/* Status Section */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-white ${animatedProgress >= 95 ? 'bg-green-500' : 'bg-green-500'
                        }`}>
                        {animatedProgress >= 95 ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        ) : (
                            <CarIcon />
                        )}
                    </div>

                    <div className="flex-1">
                        <p className="font-semibold text-gray-900">{stepInfo.title}</p>
                        <p className="text-sm text-gray-500">{stepInfo.subtitle}</p>
                    </div>

                    <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${animatedProgress >= 95
                            ? 'bg-green-100 text-green-700'
                            : 'bg-green-50 text-green-600'
                        }`}>
                        {animatedProgress >= 95 ? 'Listo' : 'Activo'}
                    </div>
                </div>
            </div>
        </div>
    );
}
