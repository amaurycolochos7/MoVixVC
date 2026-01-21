"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Timer, DollarSign } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface RequestCardProps {
    request: any;
    driverLocation?: { lat: number; lng: number } | null;
    onCardClick?: (req: any) => void;
    onOffer: (req: any) => void;
    onAccept: (req: any) => void;
    onShowMap: (req: any) => void;
}

export function RequestCard({ request, driverLocation, onCardClick, onOffer, onAccept, onShowMap }: RequestCardProps) {
    // Countdown timer - uses server's remaining_seconds, then decrements locally
    const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
    const mountTimeRef = useRef<number>(Date.now());
    const lastServerValueRef = useRef<number | null>(null);

    useEffect(() => {
        // Use server-calculated remaining_seconds if available (from RPC function)
        let serverRemaining: number;

        if (typeof request.remaining_seconds === 'number') {
            // Server calculated this value using NOW() - most accurate
            serverRemaining = request.remaining_seconds;
            console.log(`⏱️ [${request.service_type}] Server remaining_seconds: ${serverRemaining}`);
        } else if (request.request_expires_at && request.created_at) {
            // Fallback: calculate from timestamps
            const expiresMs = new Date(request.request_expires_at).getTime();
            const createdMs = new Date(request.created_at).getTime();
            const totalDurationSec = Math.round((expiresMs - createdMs) / 1000);
            const elapsedSinceCreation = Math.max(0, (Date.now() - createdMs) / 1000);
            serverRemaining = Math.max(0, Math.round(totalDurationSec - elapsedSinceCreation));
            console.log(`⏱️ [${request.service_type}] Fallback remaining: ${serverRemaining}s (no server value)`);
        } else {
            return;
        }

        // Always reset when server value changes
        if (lastServerValueRef.current !== serverRemaining) {
            lastServerValueRef.current = serverRemaining;
            mountTimeRef.current = Date.now();
        }

        const getRemaining = () => {
            const elapsedSinceMount = (Date.now() - mountTimeRef.current) / 1000;
            return Math.max(0, Math.round(serverRemaining - elapsedSinceMount));
        };

        setSecondsRemaining(getRemaining());

        const timer = setInterval(() => {
            const remaining = getRemaining();
            setSecondsRemaining(remaining);
            if (remaining <= 0) clearInterval(timer);
        }, 1000);

        return () => clearInterval(timer);
    }, [request.remaining_seconds, request.request_expires_at, request.created_at, request.service_type]);

    const price = request.estimated_price || (request.service_type === "mandadito" ? 25 : 35);

    // Colores actualizados - más suaves
    const serviceColor = request.service_type === 'moto_ride'
        ? 'from-orange-500 to-orange-600'
        : request.service_type === 'mandadito'
            ? 'from-blue-500 to-blue-600'
            : 'from-indigo-500 to-indigo-600';

    return (
        <Card
            className="overflow-hidden border-0 shadow-lg rounded-xl cursor-pointer active:scale-[0.98] transition-all duration-200 hover:shadow-xl"
            onClick={() => onCardClick?.(request)}
        >
            {/* Compact Header */}
            <div className={`bg-gradient-to-r ${serviceColor} p-3 text-white`}>
                <div className="flex items-center justify-between mb-2">
                    {/* Service Badge */}
                    <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-bold capitalize">
                            {request.service_type === 'taxi' ? 'Taxi' : request.service_type === 'moto_ride' ? 'Moto Ride' : 'Mandadito'}
                        </span>
                    </div>

                    {/* Timer - matches client format */}
                    {secondsRemaining > 0 && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-xs ${secondsRemaining <= 10
                            ? 'bg-red-500/40 text-white'
                            : 'bg-white/20 text-white'
                            }`}>
                            <Timer className="w-3 h-3" />
                            <span>
                                {secondsRemaining >= 60
                                    ? `${Math.floor(secondsRemaining / 60)}:${(secondsRemaining % 60).toString().padStart(2, '0')}`
                                    : `${secondsRemaining}s`
                                }
                            </span>
                        </div>
                    )}
                </div>

                {/* Price Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">${price}</span>
                        <span className="text-white/80 text-sm">MXN</span>
                    </div>
                    {/* Basic Info */}
                    <div className="text-xs text-white/90">
                        {request.service_type === 'mandadito' ? (
                            <span>🛒 {request.request_stops?.length || 0} parada{(request.request_stops?.length || 0) !== 1 ? 's' : ''}</span>
                        ) : (
                            <span className="truncate">📍 {request.origin_neighborhood || 'Origen'}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white px-3 py-2 flex gap-2 justify-center">
                <Button
                    variant="outline"
                    className={`flex-1 max-w-[120px] ${request.service_type === 'moto_ride'
                        ? 'border-orange-300 text-orange-600 hover:bg-orange-50'
                        : request.service_type === 'mandadito'
                            ? 'border-blue-300 text-blue-600 hover:bg-blue-50'
                            : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                        } rounded-lg h-8 font-medium text-xs`}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onOffer(request);
                    }}
                >
                    <DollarSign className="h-3 w-3 mr-1 flex-shrink-0" />
                    Ofertar
                </Button>
                <Button
                    className={`flex-1 max-w-[120px] ${request.service_type === 'moto_ride'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : request.service_type === 'mandadito'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-indigo-500 hover:bg-indigo-600'
                        } text-white font-semibold rounded-lg h-8 text-xs`}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onAccept(request);
                    }}
                >
                    <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                    Aceptar
                </Button>
            </div>
        </Card>
    );
}
