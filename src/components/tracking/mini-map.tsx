"use client";

import { useMemo } from "react";

interface MiniMapProps {
    driverLat: number;
    driverLng: number;
    clientLat: number;
    clientLng: number;
    isMoving?: boolean;
}

/**
 * Professional Mini-Map similar to Uber/Didi
 * Clean design with map-like appearance
 */
export function MiniMap({
    driverLat,
    driverLng,
    clientLat,
    clientLng,
    isMoving = true,
}: MiniMapProps) {
    // Calculate distance
    const distance = useMemo(() => {
        if (!driverLat || !clientLat || !driverLng || !clientLng) return 0;
        const R = 6371000;
        const dLat = (clientLat - driverLat) * (Math.PI / 180);
        const dLng = (clientLng - driverLng) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(driverLat * (Math.PI / 180)) * Math.cos(clientLat * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }, [driverLat, driverLng, clientLat, clientLng]);

    // Progress: 0 = far, 1 = arrived
    const progress = useMemo(() => {
        const maxDist = 2000;
        return Math.min(1, 1 - (distance / maxDist));
    }, [distance]);

    const arrived = distance < 50;
    const timeEstimate = Math.max(1, Math.round(distance / 250));

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
            {/* Map Area - Light gray with streets pattern */}
            <div className="relative h-40 bg-gradient-to-b from-gray-100 to-gray-50 overflow-hidden">
                {/* Fake streets pattern */}
                <svg className="absolute inset-0 w-full h-full opacity-30">
                    <defs>
                        <pattern id="streets" width="40" height="40" patternUnits="userSpaceOnUse">
                            <line x1="0" y1="20" x2="40" y2="20" stroke="#94a3b8" strokeWidth="2" />
                            <line x1="20" y1="0" x2="20" y2="40" stroke="#94a3b8" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#streets)" />
                </svg>

                {/* Route line */}
                <svg className="absolute inset-0 w-full h-full">
                    {/* Shadow of route */}
                    <line
                        x1="15%"
                        y1="50%"
                        x2="85%"
                        y2="50%"
                        stroke="rgba(0,0,0,0.1)"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    {/* Route background (gray) */}
                    <line
                        x1="15%"
                        y1="50%"
                        x2="85%"
                        y2="50%"
                        stroke="#e5e7eb"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                    {/* Route progress (blue) */}
                    <line
                        x1="15%"
                        y1="50%"
                        x2={`${15 + (progress * 70)}%`}
                        y2="50%"
                        stroke="#3b82f6"
                        strokeWidth="6"
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                    />
                    {/* Remaining route (dashed) */}
                    <line
                        x1={`${15 + (progress * 70)}%`}
                        y1="50%"
                        x2="85%"
                        y2="50%"
                        stroke="#3b82f6"
                        strokeWidth="3"
                        strokeDasharray="8 6"
                        strokeLinecap="round"
                        opacity="0.5"
                    />
                </svg>

                {/* Destination Pin */}
                <div
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ right: '10%' }}
                >
                    <div className="relative">
                        {/* Pulse effect */}
                        <div className="absolute inset-0 w-12 h-12 -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 bg-red-500/20 rounded-full animate-ping" />
                        {/* Pin */}
                        <div className="w-10 h-10 bg-red-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                            <span className="text-white text-lg">📍</span>
                        </div>
                        {/* Label */}
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            Destino
                        </div>
                    </div>
                </div>

                {/* Car Icon */}
                <div
                    className={`absolute top-1/2 -translate-y-1/2 transition-all duration-1000 ${isMoving && !arrived ? 'animate-pulse' : ''}`}
                    style={{ left: `${10 + (progress * 70)}%` }}
                >
                    <div className="relative">
                        {/* Car container */}
                        <div className="w-14 h-14 bg-black rounded-full border-4 border-white shadow-xl flex items-center justify-center">
                            <span className="text-2xl">🚗</span>
                        </div>
                        {/* Live indicator */}
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Info Bar */}
            <div className="p-4 bg-white border-t">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-2xl font-bold text-gray-900">
                            {arrived ? "¡Llegó!" : distance < 100 ? "Llegando..." :
                                distance < 1000 ? `${Math.round(distance)}m` :
                                    `${(distance / 1000).toFixed(1)} km`}
                        </p>
                        <p className="text-sm text-gray-500">
                            {arrived ? "Tu conductor está aquí" : `Llegará en ~${timeEstimate} min`}
                        </p>
                    </div>
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${arrived ? 'bg-green-500' : 'bg-blue-500'}`}>
                        <span className="text-white text-2xl font-bold">
                            {arrived ? "✓" : timeEstimate}
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-1000 ${arrived ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
