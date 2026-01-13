"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Timer, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";

interface RequestCardProps {
    request: any;
    driverLocation?: { lat: number; lng: number } | null;
    onCardClick?: (req: any) => void;
    onOffer: (req: any) => void;
    onAccept: (req: any) => void;
    onShowMap: (req: any) => void;
}

export function RequestCard({ request, driverLocation, onCardClick, onOffer, onAccept, onShowMap }: RequestCardProps) {
    // Countdown timer for expiration
    const [secondsRemaining, setSecondsRemaining] = useState(() => {
        if (request.request_expires_at) {
            const remaining = Math.max(0, Math.floor((new Date(request.request_expires_at).getTime() - Date.now()) / 1000));
            return remaining;
        }
        return 0;
    });

    useEffect(() => {
        if (!request.request_expires_at) return;

        const timer = setInterval(() => {
            const remaining = Math.max(0, Math.floor((new Date(request.request_expires_at).getTime() - Date.now()) / 1000));
            setSecondsRemaining(remaining);
        }, 1000);

        return () => clearInterval(timer);
    }, [request.request_expires_at]);

    const price = request.estimated_price || (request.service_type === "mandadito" ? 25 : 35);

    // Colores actualizados - más suaves
    const serviceColor = request.service_type === 'mandadito'
        ? 'from-blue-500 to-blue-600'
        : 'from-indigo-500 to-indigo-600';

    return (
        <Card
            className="overflow-hidden border-0 shadow-lg rounded-2xl cursor-pointer active:scale-[0.98] transition-all duration-200 hover:shadow-xl"
            onClick={() => onCardClick?.(request)}
        >
            {/* Compact Header */}
            <div className={`bg-gradient-to-r ${serviceColor} p-4 text-white`}>
                <div className="flex items-center justify-between mb-3">
                    {/* Service Badge */}
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-lg font-bold capitalize">
                            {request.service_type === 'taxi' ? 'Taxi' : 'Mandadito'}
                        </span>
                    </div>

                    {/* Timer */}
                    {secondsRemaining > 0 && (
                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-sm ${secondsRemaining <= 10
                            ? 'bg-red-500/40 text-white'
                            : 'bg-white/20 text-white'
                            }`}>
                            <Timer className="w-4 h-4" />
                            <span>{secondsRemaining}s</span>
                        </div>
                    )}
                </div>

                {/* Large Price */}
                <div className="mb-2">
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black">${price}</span>
                        <span className="text-white/80 text-lg">MXN</span>
                    </div>
                </div>

                {/* Basic Info */}
                <div className="text-sm text-white/90">
                    {request.service_type === 'mandadito' ? (
                        <p>🛒 {request.request_stops?.length || 0} parada{(request.request_stops?.length || 0) !== 1 ? 's' : ''}</p>
                    ) : (
                        <p className="truncate">📍 {request.origin_neighborhood || request.origin_address || 'Origen'}</p>
                    )}
                </div>

                {/* View Details Hint */}
                <div className="text-center text-white/70 text-xs mt-2">
                    Haz clic para ver mapa y detalles
                </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white p-3 flex gap-2">
                <Button
                    variant="outline"
                    className={`flex-1 ${request.service_type === 'mandadito'
                        ? 'border-blue-300 text-blue-600 hover:bg-blue-50'
                        : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
                        } rounded-xl h-11 font-semibold`}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onOffer(request);
                    }}
                >
                    <DollarSign className="h-4 w-4 mr-1" />
                    Ofertar
                </Button>
                <Button
                    className={`flex-1 ${request.service_type === 'mandadito'
                        ? 'bg-blue-500 hover:bg-blue-600'
                        : 'bg-indigo-500 hover:bg-indigo-600'
                        } text-white font-bold rounded-xl h-11`}
                    onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onAccept(request);
                    }}
                >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Aceptar
                </Button>
            </div>
        </Card>
    );
}
