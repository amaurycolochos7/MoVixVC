"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, CheckCircle, DollarSign, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { MiniMapPreview } from "@/components/maps/mini-map-preview";
import { StopDetailModal } from "@/components/radar/stop-detail-modal";

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

// Countdown Component - Synced with client timer
const CountdownTimer = ({
    createdAt,
    expiresAt,
    onExpire
}: {
    createdAt: string;
    expiresAt?: string;
    onExpire?: () => void;
}) => {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        const calculateTime = () => {
            const now = Date.now();
            let expires;

            if (expiresAt) {
                // Use the exact same expiration time as the client
                expires = new Date(expiresAt).getTime();
            } else {
                // Fallback for legacy requests: 40s default from created_at
                const created = new Date(createdAt).getTime();
                expires = created + 40000;
            }

            return Math.max(0, Math.ceil((expires - now) / 1000));
        };

        setTimeLeft(calculateTime());
        const timer = setInterval(() => {
            const remaining = calculateTime();
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timer);
                // Auto-close modal when expired
                if (onExpire) {
                    setTimeout(() => onExpire(), 500); // Small delay for visual feedback
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [createdAt, expiresAt, onExpire]);

    if (timeLeft === null) return <span className="text-slate-500 text-xs">Calculando...</span>;
    if (timeLeft <= 0) return <span className="text-red-500 font-bold">Expirado</span>;

    // Format similar to client: show minutes:seconds if > 60s
    const display = timeLeft >= 60
        ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
        : `${timeLeft}s`;

    return (
        <span className="text-orange-400 font-bold animate-pulse">
            Expira en {display}
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
    const supabase = createClient();
    console.log("🛠️ NEGOTIATION MODAL REQUEST:", { id: request.id, expires_at: request.request_expires_at });

    const [offerAmount, setOfferAmount] = useState<string>("");
    const [mounted, setMounted] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [mapLocation, setMapLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [selectedStop, setSelectedStop] = useState<any>(null);
    const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0);

    // Fresh expiration time from DB (to ensure sync with client)
    const [freshExpiresAt, setFreshExpiresAt] = useState<string | null>(request.request_expires_at || null);

    // Local state for stops to handle missing data fallback
    const [stops, setStops] = useState<any[]>(request.request_stops || []);
    const [isLoadingStops, setIsLoadingStops] = useState(false);

    useEffect(() => {
        setMounted(true);

        // Fetch fresh expiration time to ensure sync with client
        const fetchFreshExpiration = async () => {
            const { data } = await supabase
                .from('service_requests')
                .select('request_expires_at')
                .eq('id', request.id)
                .single();

            if (data?.request_expires_at) {
                console.log("✅ Fresh expires_at fetched:", data.request_expires_at);
                setFreshExpiresAt(data.request_expires_at);
            }
        };
        fetchFreshExpiration();

        // Fallback: Fetch stops if missing
        if (!request.request_stops || request.request_stops.length === 0) {
            const fetchStops = async () => {
                setIsLoadingStops(true);
                console.log("⚠️ Stops missing, fetching in modal...");
                const { data } = await supabase
                    .from('request_stops')
                    .select(`
                        *,
                        stop_items (*)
                    `)
                    .eq('request_id', request.id)
                    .order('stop_order');

                if (data && data.length > 0) {
                    console.log("✅ Stops fetched in modal:", data.length);
                    setStops(data);
                } else {
                    console.log("❌ Still no stops found in DB");
                }
                setIsLoadingStops(false);
            };
            fetchStops();
        } else {
            setStops(request.request_stops);
        }

        return () => setMounted(false);
    }, [request.id, request.request_stops]); // Re-run if request changes

    // ... rest of imports/functions

    // Initialize offer amount
    useEffect(() => {
        // FORCE $35 for taxi
        const defaultPrice = request.service_type === 'taxi'
            ? 35
            : (request.estimated_price || 22);
        setOfferAmount(String(defaultPrice));
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
                                {request.service_type === 'taxi' ? 'Taxi' : request.service_type === 'moto_ride' ? 'Moto Ride' : 'Mandadito'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                            <Clock className="w-3 h-3" />
                            <CountdownTimer
                                createdAt={request.created_at}
                                expiresAt={freshExpiresAt || request.request_expires_at}
                                onExpire={onClose}
                            />
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

                {/* Conditional Layout based on service type */}
                {/* TAXI and MOTO RIDE: Show origin/destination timeline */}
                {(request.service_type === 'taxi' || request.service_type === 'moto_ride') ? (
                    /* TAXI: Timeline Route */
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

                        {/* Pickup Point - Clickable */}
                        <div
                            className="flex items-start gap-3 relative cursor-pointer active:scale-[0.98] transition-transform"
                            onClick={() => {
                                if (request.origin_lat && request.origin_lng) {
                                    setMapLocation({ lat: request.origin_lat, lng: request.origin_lng });
                                    setShowMap(true);
                                }
                            }}
                        >
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-1 z-10 bg-slate-900">
                                    <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                                </div>
                                <div className="w-0.5 h-full min-h-[48px] bg-gradient-to-b from-emerald-500 to-red-500 absolute top-8 left-4 -translate-x-1/2" />
                            </div>
                            <div className="flex-1 pb-4">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">RECOGER </span>
                                        <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs">
                                            {etaToClient > 0 ? `a ${etaToClient} min` : ''}
                                            {distanceToClient > 0 ? ` (${distanceToClient.toFixed(1)} km)` : ''}
                                        </span>
                                    </div>
                                    {request.origin_lat && request.origin_lng && (
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                            Ver mapa
                                        </span>
                                    )}
                                </div>
                                <p className="text-white font-semibold text-lg">{originName}</p>
                                {request.origin_references && (
                                    <p className="text-slate-400 text-sm mt-1 bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                                        📝 {request.origin_references}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Destination Point - Clickable */}
                        <div
                            className="flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                            onClick={() => {
                                if (request.destination_lat && request.destination_lng) {
                                    setMapLocation({ lat: request.destination_lat, lng: request.destination_lng });
                                    setShowMap(true);
                                }
                            }}
                        >
                            <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center z-10 bg-slate-900">
                                    <div className="w-4 h-4 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider">LLEVAR A</span>
                                        <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded text-xs">
                                            {tripETA > 0 ? `${tripETA} min` : ''}
                                            {tripDistance > 0 ? ` (${tripDistance.toFixed(1)} km)` : ''}
                                        </span>
                                    </div>
                                    {request.destination_lat && request.destination_lng && (
                                        <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30">
                                            Ver mapa
                                        </span>
                                    )}
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
                ) : request.service_type === 'mandadito' ? (
                    /* MANDADITO: Different views for shopping vs delivery */
                    <div className="space-y-4">
                        {/* Check if it's a delivery (package pickup/dropoff) or shopping */}
                        {request.mandadito_type === 'delivery' ? (
                            /* DELIVERY: Pickup -> Dropoff Timeline (like moto_ride) */
                            <div className="space-y-0 pl-2">
                                {/* Pickup Point */}
                                <div
                                    className="flex items-start gap-3 relative cursor-pointer active:scale-[0.98] transition-transform"
                                    onClick={() => {
                                        if (request.origin_lat && request.origin_lng) {
                                            setMapLocation({ lat: request.origin_lat, lng: request.origin_lng });
                                            setShowMap(true);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1 z-10 bg-slate-900">
                                            <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                        </div>
                                        <div className="w-0.5 h-full min-h-[48px] bg-gradient-to-b from-blue-500 to-green-500 absolute top-8 left-4 -translate-x-1/2" />
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">RECOGER PAQUETE</span>
                                            {request.origin_lat && request.origin_lng && (
                                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                                    Ver mapa
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-white font-semibold text-lg">{request.origin_address || request.origin_neighborhood || "Ubicación GPS"}</p>
                                        {request.origin_references && (
                                            <p className="text-slate-400 text-sm mt-1 bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                                                {request.origin_references}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Dropoff Point */}
                                <div
                                    className="flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                                    onClick={() => {
                                        if (request.delivery_lat && request.delivery_lng) {
                                            setMapLocation({ lat: request.delivery_lat, lng: request.delivery_lng });
                                            setShowMap(true);
                                        } else if (request.destination_lat && request.destination_lng) {
                                            setMapLocation({ lat: request.destination_lat, lng: request.destination_lng });
                                            setShowMap(true);
                                        }
                                    }}
                                >
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center z-10 bg-slate-900">
                                            <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-green-400 text-xs font-bold uppercase tracking-wider">ENTREGAR EN</span>
                                            <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                                                Ver mapa
                                            </span>
                                        </div>
                                        <p className="text-white font-semibold text-lg">
                                            {request.delivery_address || request.destination_address || "Destino"}
                                        </p>
                                        {request.delivery_references && (
                                            <p className="text-slate-400 text-sm mt-1 bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                                                {request.delivery_references}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : request.mandadito_type === 'payment' ? (
                            /* PAYMENT: Pickup money -> Pay at location */
                            <div className="space-y-4">
                                {/* Timeline */}
                                <div className="space-y-0 pl-2">
                                    {/* Pickup Point - Where to get money */}
                                    <div
                                        className="flex items-start gap-3 relative cursor-pointer active:scale-[0.98] transition-transform"
                                        onClick={() => {
                                            if (request.origin_lat && request.origin_lng) {
                                                setMapLocation({ lat: request.origin_lat, lng: request.origin_lng });
                                                setShowMap(true);
                                            }
                                        }}
                                    >
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-1 z-10 bg-slate-900">
                                                <div className="w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                            </div>
                                            <div className="w-0.5 h-full min-h-[48px] bg-gradient-to-b from-blue-500 to-green-500 absolute top-8 left-4 -translate-x-1/2" />
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">RECOGER DINERO</span>
                                                {request.origin_lat && request.origin_lng && (
                                                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                                        Ver mapa
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-white font-semibold text-lg">{request.origin_address || "Ubicación del cliente"}</p>
                                        </div>
                                    </div>

                                    {/* Payment Point */}
                                    <div
                                        className="flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                                        onClick={() => {
                                            if (request.delivery_lat && request.delivery_lng) {
                                                setMapLocation({ lat: request.delivery_lat, lng: request.delivery_lng });
                                                setShowMap(true);
                                            } else if (request.destination_lat && request.destination_lng) {
                                                setMapLocation({ lat: request.destination_lat, lng: request.destination_lng });
                                                setShowMap(true);
                                            }
                                        }}
                                    >
                                        <div className="flex flex-col items-center">
                                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center z-10 bg-slate-900">
                                                <div className="w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-green-400 text-xs font-bold uppercase tracking-wider">PAGAR EN</span>
                                                <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                                                    Ver mapa
                                                </span>
                                            </div>
                                            <p className="text-white font-semibold text-lg">
                                                {request.delivery_address || request.destination_address || "Lugar de pago"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Details Card */}
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                    <p className="text-green-400 font-bold text-sm mb-3">DETALLES DEL PAGO</p>
                                    <div className="space-y-2">
                                        {request.notes && (
                                            <p className="text-white text-sm">{request.notes}</p>
                                        )}
                                        {request.delivery_references && (
                                            <p className="text-slate-300 text-sm bg-slate-800/50 p-2 rounded-lg">
                                                {request.delivery_references}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* SHOPPING: Shopping List */
                            <>
                                {/* Shopping Stops Section */}
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                                    <p className="text-orange-400 font-bold text-sm mb-3 flex items-center gap-2">
                                        Lista de compras ({stops.length} parada{stops.length !== 1 ? 's' : ''})
                                    </p>
                                    <div className="space-y-4">
                                        {stops.map((stop: any, idx: number) => (
                                            <div
                                                key={stop.id || idx}
                                                className="bg-slate-800/50 rounded-lg p-3 cursor-pointer active:scale-95 transition-transform hover:bg-slate-800 border border-transparent hover:border-orange-500/50"
                                                onClick={() => {
                                                    setSelectedStop(stop);
                                                    setSelectedStopIndex(idx);
                                                }}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-bold shadow-lg shadow-orange-900/20">
                                                            {idx + 1}
                                                        </span>
                                                        <p className="text-white font-semibold line-clamp-1">{stop.address || 'Tienda sin nombre'}</p>
                                                    </div>
                                                    <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">
                                                        Ver detalle
                                                    </span>
                                                </div>
                                                {stop.instructions && (
                                                    <p className="text-slate-400 text-xs mb-2 ml-8 line-clamp-1">{stop.instructions}</p>
                                                )}
                                                {stop.stop_items && stop.stop_items.length > 0 ? (
                                                    <div className="ml-8 space-y-1">
                                                        <p className="text-slate-400 text-xs font-medium">Productos ({stop.stop_items.length}):</p>
                                                        {stop.stop_items.slice(0, 2).map((item: any, iIdx: number) => (
                                                            <div key={iIdx} className="flex items-center justify-between text-sm">
                                                                <span className="text-white line-clamp-1">• {item.item_name}</span>
                                                                <span className="text-orange-400 font-medium whitespace-nowrap">x{item.quantity}</span>
                                                            </div>
                                                        ))}
                                                        {stop.stop_items.length > 2 && (
                                                            <p className="text-xs text-slate-500 italic">+ {stop.stop_items.length - 2} productos más...</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-slate-500 text-xs ml-8 italic">0 productos (Verifica permiso DB)</p>
                                                )}
                                            </div>
                                        ))}
                                        {(!request.request_stops || request.request_stops.length === 0) && (
                                            <div className="text-center p-4">
                                                <p className="text-slate-400 text-sm">No hay paradas visibles</p>
                                                <p className="text-slate-600 text-xs mt-1">Si deberían haber, ejecuta la migración SQL 035</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Delivery Address */}
                                <div
                                    className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 cursor-pointer active:scale-95 transition-transform hover:bg-green-500/20"
                                    onClick={() => {
                                        if (request.delivery_lat && request.delivery_lng) {
                                            setMapLocation({ lat: request.delivery_lat, lng: request.delivery_lng });
                                            setShowMap(true);
                                        } else if (request.destination_lat && request.destination_lng) {
                                            setMapLocation({ lat: request.destination_lat, lng: request.destination_lng });
                                            setShowMap(true);
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-green-400 font-bold text-sm flex items-center gap-2">
                                            Entregar en:
                                        </p>
                                        <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                                            Ver mapa
                                        </span>
                                    </div>
                                    <p className="text-white font-semibold">
                                        {request.delivery_address || request.destination_address || request.origin_address || 'Dirección no especificada'}
                                    </p>
                                    {request.delivery_references && (
                                        <p className="text-slate-400 text-sm mt-1">{request.delivery_references}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                ) : null}

                {/* Client Notes - Only for taxi */}
                {request.notes && request.service_type === 'taxi' && (
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
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={offerAmount}
                            onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setOfferAmount(val);
                            }}
                            onFocus={e => e.target.select()}
                            className="w-full h-14 text-2xl font-bold pl-10 border-slate-700 bg-slate-800 text-white focus:ring-orange-500 rounded-xl"
                            placeholder="0"
                        />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[40, 50, 60, 70].map(price => (
                            <Button
                                key={price}
                                variant={offerAmount === String(price) ? "default" : "outline"}
                                className={`h-10 border-slate-700 ${offerAmount === String(price)
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                                onClick={() => setOfferAmount(String(price))}
                            >
                                ${price}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Action Buttons - Mobile Optimized */}
                {/* Left: Enviar Oferta (for counter-offers), Right: Aceptar (for accepting client's price) */}
                <div className="mt-6 flex gap-3">
                    {/* Enviar Oferta - Only enabled when amount differs from client price */}
                    <Button
                        className={`flex-1 h-12 rounded-xl font-semibold text-sm shadow-lg ${parseInt(offerAmount, 10) !== displayPrice
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                        disabled={parseInt(offerAmount, 10) === displayPrice}
                        onClick={() => onAccept(request, parseInt(offerAmount, 10) || 0)}
                    >
                        <DollarSign className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        Ofertar ${offerAmount || 0}
                    </Button>

                    {/* Aceptar - Only enabled when amount matches client price */}
                    <Button
                        className={`flex-1 h-12 rounded-xl font-semibold text-sm shadow-lg ${parseInt(offerAmount, 10) === displayPrice
                            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            }`}
                        disabled={parseInt(offerAmount, 10) !== displayPrice}
                        onClick={() => {
                            // Only accept at client's original price
                            onAccept(request, displayPrice);
                        }}
                    >
                        <CheckCircle className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        Aceptar ${displayPrice}
                    </Button>
                </div>
            </div>

            {/* Map Preview Overlay */}
            {showMap && mapLocation && (
                <MiniMapPreview
                    lat={mapLocation.lat}
                    lng={mapLocation.lng}
                    title="Punto de Entrega"
                    onClose={() => setShowMap(false)}
                />
            )}

            {/* Stop Detail Modal */}
            {selectedStop && (
                <StopDetailModal
                    stop={selectedStop}
                    stopIndex={selectedStopIndex}
                    onClose={() => setSelectedStop(null)}
                    onAccept={(req) => onAccept(req)}  // Pass acceptance handler
                    request={request}  // Pass full request for acceptance
                />
            )}
        </div>
    );

    if (!mounted) return null;

    // USE PORTAL to escape any stacking context
    return createPortal(modalContent, document.body);
}
