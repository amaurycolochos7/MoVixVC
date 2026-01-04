"use client";

import { useEffect, useState } from "react";
import { Navigation, MapPin } from "lucide-react";
import { useTrackDriver } from "@/hooks/useTrackDriver";
import { calculateDistance, formatDistance, getDirection } from "@/lib/reverse-geocode";
import { MiniMap } from "./mini-map";

interface DriverTrackingDisplayProps {
    driverId: string;
    clientLat?: number;
    clientLng?: number;
}

export function DriverTrackingDisplay({
    driverId,
    clientLat,
    clientLng
}: DriverTrackingDisplayProps) {
    const { position, loading } = useTrackDriver(driverId);

    // Calculate distance
    const distance = (clientLat && clientLng && position)
        ? calculateDistance(clientLat, clientLng, position.lat, position.lng)
        : null;

    const direction = (clientLat && clientLng && position)
        ? getDirection(clientLat, clientLng, position.lat, position.lng)
        : null;

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6">
                <div className="flex items-center justify-center gap-3 text-white">
                    <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                    <span className="text-lg">Conectando con tu conductor...</span>
                </div>
            </div>
        );
    }

    if (!position) {
        return (
            <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl p-6">
                <div className="flex items-center justify-center gap-3 text-white">
                    <MapPin className="w-5 h-5" />
                    <span>Esperando ubicación del conductor...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Mini Map with live positions */}
            <MiniMap
                driverLat={position.lat}
                driverLng={position.lng}
                clientLat={clientLat || 0}
                clientLng={clientLng || 0}
                isMoving={true}
            />

            {/* Quick info */}
            {distance !== null && direction && (
                <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Navigation className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-gray-900">
                                {formatDistance(distance)}
                            </p>
                            <p className="text-sm text-gray-500">
                                Viene del {direction}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Tiempo est.</p>
                        <p className="text-lg font-bold text-gray-900">
                            {Math.max(1, Math.round(distance / 250))} min
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
