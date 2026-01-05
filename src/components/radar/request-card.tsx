"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Clock, DollarSign, Map, CheckCircle, Timer, Navigation, Star, Route } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useEffect, useMemo } from "react";

interface RequestCardProps {
    request: any;
    driverLocation?: { lat: number; lng: number } | null;
    onCardClick?: (req: any) => void;
    onOffer: (req: any) => void;
    onAccept: (req: any) => void;
    onShowMap: (req: any) => void;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate ETA based on distance (assuming 25 km/h average in city)
function calculateETA(distanceKm: number): number {
    return Math.ceil((distanceKm / 25) * 60); // minutes
}

export function RequestCard({ request, driverLocation, onCardClick, onOffer, onAccept, onShowMap }: RequestCardProps) {
    const hasClientCoords = request.origin_lat && request.origin_lng &&
        (request.origin_lat !== 0 || request.origin_lng !== 0);

    const hasDestCoords = request.destination_lat && request.destination_lng &&
        (request.destination_lat !== 0 || request.destination_lng !== 0);

    const timeAgo = request.created_at
        ? formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: es })
        : "Hace unos momentos";

    // Calculate distances and ETAs
    const metrics = useMemo(() => {
        let distanceToClient = 0;
        let etaToClient = 0;
        let tripDistance = 0;
        let tripETA = 0;

        // Distance from driver to client
        if (driverLocation && hasClientCoords) {
            distanceToClient = calculateDistance(
                driverLocation.lat,
                driverLocation.lng,
                request.origin_lat,
                request.origin_lng
            );
            etaToClient = calculateETA(distanceToClient);
        }

        // Distance from client to destination
        if (hasClientCoords && hasDestCoords) {
            tripDistance = calculateDistance(
                request.origin_lat,
                request.origin_lng,
                request.destination_lat,
                request.destination_lng
            );
            tripETA = calculateETA(tripDistance);
        }

        return {
            distanceToClient,
            etaToClient,
            tripDistance,
            tripETA,
            totalTime: etaToClient + tripETA
        };
    }, [driverLocation, request, hasClientCoords, hasDestCoords]);

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

    // Origin and destination names
    const originName = request.origin_neighborhood || request.origin_address || "Ubicación GPS";
    const destName = request.destination_neighborhood || request.destination_address || "Destino";
    const originRef = request.origin_references;
    const destRef = request.destination_references;

    const price = request.estimated_price || (request.service_type === "mandadito" ? 22 : 35);

    return (
        <Card
            className="overflow-hidden border-0 shadow-2xl rounded-3xl cursor-pointer active:scale-[0.99] transition-transform duration-100"
            onClick={() => {
                console.log("Card clicked in RequestCard component", request.id);
                onCardClick?.(request);
            }}
        >
            {/* === PREMIUM DARK HEADER === */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white">

                {/* Top row: Service badge + Timer */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-semibold capitalize">
                                {request.service_type === 'taxi' ? 'Económico' : 'Mandadito'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>{timeAgo}</span>
                        </div>
                    </div>

                    {/* Countdown */}
                    {secondsRemaining > 0 && (
                        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold ${secondsRemaining <= 10
                            ? 'bg-red-500/30 text-red-400'
                            : 'bg-orange-500/20 text-orange-400'
                            }`}>
                            <Timer className="w-4 h-4" />
                            <span>{secondsRemaining}s</span>
                        </div>
                    )}
                </div>

                {/* === LARGE PRICE === */}
                <div className="mb-6">
                    <p className="text-slate-400 text-sm font-medium mb-1">Precio del viaje</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black tracking-tight">${price}</span>
                        <span className="text-slate-400 text-xl font-medium">MXN</span>
                    </div>
                </div>

                {/* === TIMELINE ROUTE (DiDi Style) === */}
                <div className="space-y-0">
                    {/* Pickup Point */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                            <div className="w-0.5 h-12 bg-gradient-to-b from-emerald-500 to-red-500" />
                        </div>
                        <div className="flex-1 pb-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-emerald-400 font-bold text-lg">
                                    {metrics.etaToClient > 0 ? `${metrics.etaToClient} min` : '— min'}
                                </span>
                                <span className="text-slate-500 text-sm">
                                    ({metrics.distanceToClient > 0 ? `${metrics.distanceToClient.toFixed(1)} km` : '— km'})
                                </span>
                            </div>
                            <p className="text-white font-semibold truncate">{originName}</p>
                            {originRef && (
                                <p className="text-slate-400 text-sm truncate mt-0.5">📝 {originRef}</p>
                            )}
                        </div>
                    </div>

                    {/* Destination Point */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                                <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-red-400 font-bold text-lg">
                                    {metrics.tripETA > 0 ? `${metrics.tripETA} min` : '— min'}
                                </span>
                                <span className="text-slate-500 text-sm">
                                    ({metrics.tripDistance > 0 ? `${metrics.tripDistance.toFixed(1)} km` : '— km'})
                                </span>
                            </div>
                            <p className="text-white font-semibold truncate">{destName}</p>
                            {destRef && (
                                <p className="text-slate-400 text-sm truncate mt-0.5">📝 {destRef}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Notes if any */}
                {request.notes && (
                    <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-400 text-sm">💬 {request.notes}</p>
                    </div>
                )}
            </div>

            {/* === ACTION BUTTONS === */}
            <div className="bg-slate-900 p-4 space-y-2">
                {/* Secondary actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white rounded-xl h-12"
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
                        className="flex-1 bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white rounded-xl h-12"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOffer(request);
                        }}
                    >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Ofertar
                    </Button>
                </div>

                {/* Primary accept button - ORANGE like DiDi */}
                <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl h-14 text-lg shadow-lg shadow-orange-500/30"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAccept(request);
                    }}
                >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Aceptar (${price})
                </Button>
            </div>
        </Card>
    );
}
