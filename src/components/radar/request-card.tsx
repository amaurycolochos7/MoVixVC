"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Clock, DollarSign, Map, CheckCircle, Timer } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect } from "react";

interface RequestCardProps {
    request: any;
    onOffer: (req: any) => void;
    onAccept: (req: any) => void;
    onShowMap: (req: any) => void;
}

export function RequestCard({ request, onOffer, onAccept, onShowMap }: RequestCardProps) {
    const hasCoords = request.origin_lat && request.origin_lng &&
        (request.origin_lat !== 0 || request.origin_lng !== 0);

    const timeAgo = request.created_at
        ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: es })
        : "Hace unos momentos";

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

    // Determine what to show for origin - avoid duplicates
    const originMain = request.origin_neighborhood || request.origin_address || "Ubicación GPS";
    const originRef = request.origin_references;
    const showOriginRef = originRef && originRef !== originMain && originRef !== request.origin_address;

    // Determine what to show for destination - avoid duplicates
    const destMain = request.destination_neighborhood || request.destination_address || "Por confirmar";
    const destRef = request.destination_references;
    const showDestRef = destRef && destRef !== destMain && destRef !== request.destination_address;

    return (
        <Card
            className="overflow-hidden border-0 shadow-lg"
            style={{ backgroundColor: '#ffffff' }}
        >
            {/* Header with price */}
            <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-white">
                <div className="flex justify-between items-center">
                    <div>
                        <span className="text-xs opacity-80 uppercase tracking-wide">Servicio de</span>
                        <h3 className="text-lg font-bold capitalize">{request.service_type}</h3>
                    </div>
                    <div className="text-right">
                        <span className="text-xs opacity-80">Precio estimado</span>
                        <p className="text-2xl font-bold">${request.estimated_price || (request.service_type === "mandadito" ? 22 : 33)}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                    <div className="flex items-center gap-1 opacity-80">
                        <Clock className="h-3 w-3" />
                        <span>{timeAgo}</span>
                        {hasCoords && <span className="ml-2">GPS</span>}
                    </div>
                    {/* Countdown */}
                    {secondsRemaining > 0 && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${secondsRemaining <= 10 ? 'bg-red-500/30' : 'bg-white/20'}`}>
                            <Timer className="h-3 w-3" />
                            <span className="font-bold">{secondsRemaining}s</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Route visualization */}
            <div className="p-4" style={{ backgroundColor: '#f9fafb' }}>
                <div className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow">
                            <MapPin className="w-3 h-3 text-white" />
                        </div>
                        <div className="w-0.5 flex-1 bg-gray-300 my-1 min-h-[50px]" />
                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shadow">
                            <MapPin className="w-3 h-3 text-white" />
                        </div>
                    </div>

                    {/* Addresses with full details */}
                    <div className="flex-1 space-y-4">
                        {/* Origin */}
                        <div className="bg-white p-3 rounded-lg border border-green-200">
                            <p className="text-xs font-bold text-green-600 uppercase mb-1">PUNTO DE RECOGIDA</p>
                            <p className="font-semibold text-gray-900">{originMain}</p>
                            {showOriginRef && (
                                <p className="text-sm text-blue-600 mt-1 font-medium">
                                    Ref: {originRef}
                                </p>
                            )}
                        </div>

                        {/* Destination */}
                        <div className="bg-white p-3 rounded-lg border border-red-200">
                            <p className="text-xs font-bold text-red-600 uppercase mb-1">DESTINO</p>
                            <p className="font-semibold text-gray-900">{destMain}</p>
                            {showDestRef && (
                                <p className="text-sm text-blue-600 mt-1 font-medium">
                                    Ref: {destRef}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Notes if any */}
            {request.notes && (
                <div className="px-4 pb-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-xs font-bold text-amber-800">Nota del cliente:</p>
                        <p className="text-sm text-amber-700 mt-1">{request.notes}</p>
                    </div>
                </div>
            )}

            {/* Actions - 3 buttons now */}
            <div className="p-4 border-t border-gray-100 space-y-2">
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            onShowMap(request);
                        }}
                    >
                        <Map className="h-4 w-4 mr-2" />
                        Ver Mapa
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => onOffer(request)}
                    >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Ofertar
                    </Button>
                </div>
                <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => onAccept(request)}
                >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aceptar servicio (${request.estimated_price || 50})
                </Button>
            </div>
        </Card>
    );
}
