"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// Helper for distance calc
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateETA(distanceKm: number) {
    if (!distanceKm) return 0;
    return Math.ceil((distanceKm / 25) * 60); // minutes
}

// Countdown Component
const CountdownTimer = ({ createdAt }: { createdAt: string }) => {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        const calculateTime = () => {
            const created = new Date(createdAt).getTime();
            const expires = created + 30000;
            const now = Date.now();
            return Math.max(0, Math.ceil((expires - now) / 1000));
        };

        setTimeLeft(calculateTime());
        const timer = setInterval(() => {
            const remaining = calculateTime();
            setTimeLeft(remaining);
            if (remaining <= 0) clearInterval(timer);
        }, 1000);

        return () => clearInterval(timer);
    }, [createdAt]);

    if (timeLeft === null) return <span className="text-slate-500 text-xs">Calculando...</span>;
    if (timeLeft <= 0) return <span className="text-red-500 font-bold">Expirado</span>;

    return (
        <span className="text-orange-400 font-bold animate-pulse">
            Expira en {timeLeft}s
        </span>
    );
};

interface NegotiationModalProps {
    request: any;
    driverLocation?: { lat: number; lng: number } | null;
    onClose: () => void;
    onAccept: (request: any, amount?: number) => void;
}

export function NegotiationModal({ request, driverLocation, onClose, onAccept }: NegotiationModalProps) {
    const [offerAmount, setOfferAmount] = useState<number>(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Initialize offer amount
    useEffect(() => {
        // FORCE $35 for taxi
        const defaultPrice = request.service_type === 'taxi'
            ? 35
            : (request.estimated_price || 22);
        setOfferAmount(defaultPrice);
    }, [request]);

    // Calculate metrics
    const hasClientCoords = request.origin_lat && request.origin_lng;
    const hasDestCoords = request.destination_lat && request.destination_lng;

    let distanceToClient = 0;
    let etaToClient = 0;
    let tripDistance = 0;
    let tripETA = 0;

    if (driverLocation && hasClientCoords) {
        distanceToClient = calculateDistance(
            driverLocation.lat,
            driverLocation.lng,
            request.origin_lat,
            request.origin_lng
        );
        etaToClient = calculateETA(distanceToClient);
    }

    if (hasClientCoords && hasDestCoords) {
        tripDistance = calculateDistance(
            request.origin_lat,
            request.origin_lng,
            request.destination_lat,
            request.destination_lng
        );
        tripETA = calculateETA(tripDistance);
    }

    const originName = request.origin_neighborhood || request.origin_address || "Ubicación GPS";
    const destName = request.destination_neighborhood || request.destination_address || "Destino";
    const displayPrice = request.service_type === 'taxi' ? 35 : (request.estimated_price || 22);

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950 text-white animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 hover:bg-slate-800 rounded-full transition text-slate-400 hover:text-white"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h1 className="text-lg font-bold">Detalles del Viaje</h1>
                <div className="w-10" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-slate-900 p-5 pb-48 space-y-6">

                {/* Top Stats */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-semibold capitalize">
                                {request.service_type === 'taxi' ? 'Económico' : 'Mandadito'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Clock className="w-3 h-3" />
                            <CountdownTimer createdAt={request.created_at} />
                        </div>
                    </div>
                </div>

                {/* Large Price Display */}
                <div>
                    <p className="text-slate-400 text-sm font-medium mb-1">Precio ofertado por cliente</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black tracking-tight text-white">
                            ${displayPrice}
                        </span>
                        <span className="text-slate-400 text-xl font-medium">MXN</span>
                    </div>
                </div>

                {/* Timeline Route */}
                <div className="space-y-0 pl-2">
                    {/* Driver Position */}
                    {driverLocation && (
                        <div className="flex items-start gap-3 relative">
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1">
                                    <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                </div>
                                <div className="w-0.5 h-12 bg-gradient-to-b from-blue-500 to-emerald-500 absolute top-8 left-4 -translate-x-1/2" />
                            </div>
                            <div className="flex-1 pb-4">
                                <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-0.5">TU UBICACIÓN</p>
                                <p className="text-white font-medium">Ubicación Actual</p>
                            </div>
                        </div>
                    )}

                    {/* Pickup Point */}
                    <div className="flex items-start gap-3 relative">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-1 z-10 bg-slate-900">
                                <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                            </div>
                            <div className="w-0.5 h-full min-h-[48px] bg-gradient-to-b from-emerald-500 to-red-500 absolute top-8 left-4 -translate-x-1/2" />
                        </div>
                        <div className="flex-1 pb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">RECOGER </span>
                                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">
                                    {etaToClient > 0 ? `a ${etaToClient} min` : ''}
                                    {distanceToClient > 0 ? ` (${distanceToClient.toFixed(1)} km)` : ''}
                                </span>
                            </div>
                            <p className="text-white font-semibold text-lg">{originName}</p>
                            {request.origin_references && (
                                <p className="text-slate-400 text-sm mt-1 bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                                    📝 {request.origin_references}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Destination Point */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center z-10 bg-slate-900">
                                <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                            </div>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-red-400 text-xs font-bold uppercase tracking-wider">LLEVAR A</span>
                                <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded text-xs">
                                    {tripETA > 0 ? `${tripETA} min` : ''}
                                    {tripDistance > 0 ? ` (${tripDistance.toFixed(1)} km)` : ''}
                                </span>
                            </div>
                            <p className="text-white font-semibold text-lg">{destName}</p>
                            {request.destination_references && (
                                <p className="text-slate-400 text-sm mt-1 bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                                    📝 {request.destination_references}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Client Notes */}
                {request.notes && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                        <p className="text-amber-400 text-sm">💬 {request.notes}</p>
                    </div>
                )}

                {/* Driver Stats */}
                <div className="bg-slate-800 rounded-xl p-4 flex justify-between text-sm">
                    <div>
                        <p className="text-slate-400">Distancia total</p>
                        <p className="text-white font-bold text-lg">
                            {((distanceToClient || 0) + (tripDistance || 0)).toFixed(1)} km
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400">Tiempo total est.</p>
                        <p className="text-white font-bold text-lg">
                            ~{(etaToClient || 0) + (tripETA || 0)} min
                        </p>
                    </div>
                </div>

                {/* Negotiation Section */}
                <div className="pt-4 border-t border-slate-800">
                    <p className="text-slate-300 font-medium mb-3">Tu contraoferta (Negociar)</p>
                    <div className="relative mb-4">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">$</div>
                        <Input
                            type="number"
                            value={offerAmount}
                            onChange={e => setOfferAmount(parseFloat(e.target.value) || 0)}
                            className="w-full h-14 text-2xl font-bold pl-10 border-slate-700 bg-slate-800 text-white focus:ring-orange-500 rounded-xl"
                            placeholder="0"
                        />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[40, 50, 60, 70].map(price => (
                            <Button
                                key={price}
                                variant={offerAmount === price ? "default" : "outline"}
                                className={`h-10 border-slate-700 ${offerAmount === price
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                                onClick={() => setOfferAmount(price)}
                            >
                                ${price}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 h-14 rounded-xl border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                        onClick={onClose}
                    >
                        Cerrar
                    </Button>
                    <Button
                        className="flex-[2] h-14 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-lg shadow-lg shadow-orange-500/20"
                        onClick={() => onAccept(request, offerAmount)}
                    >
                        Aceptar Oferta
                    </Button>
                </div>
            </div>
        </div>
    );

    if (!mounted) return null;

    // USE PORTAL to escape any stacking context
    return createPortal(modalContent, document.body);
}
