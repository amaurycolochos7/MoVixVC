"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Navigation, X, MapPin, Phone, Clock } from "lucide-react";
import { reverseGeocode, ReverseGeocodeResult } from "@/lib/mapbox";

interface MapPreviewModalProps {
    request: any;
    onClose: () => void;
}

/**
 * Beautiful Map Preview Modal for drivers - Premium Uber/Didi style
 */
export function MapPreviewModal({ request, onClose }: MapPreviewModalProps) {
    const [address, setAddress] = useState<ReverseGeocodeResult | null>(null);
    const [loading, setLoading] = useState(true);

    const hasCoords = request.origin_lat && request.origin_lng &&
        (request.origin_lat !== 0 || request.origin_lng !== 0);

    useEffect(() => {
        async function fetchAddress() {
            if (!hasCoords) {
                setLoading(false);
                return;
            }

            try {
                const result = await reverseGeocode({
                    lat: request.origin_lat,
                    lng: request.origin_lng,
                });
                setAddress(result);
            } catch (err) {
                console.error("Error fetching address:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchAddress();
    }, [request.origin_lat, request.origin_lng, hasCoords]);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-md bg-gradient-to-b from-gray-900 to-gray-950 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with gradient */}
                <div className="relative">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/50 backdrop-blur rounded-full flex items-center justify-center hover:bg-black/70 transition"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>

                    {hasCoords ? (
                        <>
                            {/* Map */}
                            <div className="w-full h-52 relative">
                                <iframe
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    loading="lazy"
                                    src={`https://www.google.com/maps?q=${request.origin_lat},${request.origin_lng}&z=16&output=embed`}
                                />
                                {/* Gradient overlay at bottom */}
                                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-900 to-transparent" />
                            </div>

                            {/* Client Info Card */}
                            <div className="px-5 pb-5 -mt-6 relative z-10">
                                {/* Status Badge */}
                                <div className="flex justify-center mb-3">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full border border-green-500/30">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                                        Ubicación GPS activa
                                    </span>
                                </div>

                                {/* Address Card */}
                                <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                            <MapPin className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {loading ? (
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-sm">Cargando dirección...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="font-semibold text-white text-base leading-snug">
                                                        {address?.street || address?.neighborhood || "Cliente"}
                                                    </p>
                                                    <p className="text-sm text-gray-400 mt-0.5">
                                                        {address?.neighborhood && address?.street !== address?.neighborhood
                                                            ? `${address.neighborhood}, ` : ''}
                                                        {address?.city || 'Ubicación GPS'}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Reference - If provided */}
                                {request.origin_references && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-amber-400 text-lg">🏠</span>
                                            <div>
                                                <p className="text-xs text-amber-400/70 uppercase tracking-wide font-medium">Referencia</p>
                                                <p className="text-sm text-amber-200 font-medium">{request.origin_references}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Quick Info Row */}
                                <div className="flex gap-3 mb-5">
                                    <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                                        <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs text-gray-400">ETA</p>
                                        <p className="text-sm text-white font-semibold">~5 min</p>
                                    </div>
                                    <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                                        <MapPin className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs text-gray-400">Distancia</p>
                                        <p className="text-sm text-white font-semibold">≈2 km</p>
                                    </div>
                                    {request.contact_phone && (
                                        <div className="flex-1 bg-white/5 rounded-xl p-3 text-center">
                                            <Phone className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                                            <p className="text-xs text-gray-400">Llamar</p>
                                            <p className="text-sm text-white font-semibold">Cliente</p>
                                        </div>
                                    )}
                                </div>

                                {/* Navigation Button - Premium Style */}
                                <Button
                                    className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-base rounded-xl shadow-lg shadow-blue-500/25 border-0"
                                    onClick={() => {
                                        window.open(
                                            `https://www.google.com/maps/dir/?api=1&destination=${request.origin_lat},${request.origin_lng}`,
                                            '_blank'
                                        );
                                    }}
                                >
                                    <Navigation className="w-5 h-5 mr-2" />
                                    Iniciar navegación
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MapPin className="w-8 h-8 text-gray-500" />
                            </div>
                            <p className="font-medium text-white">Sin coordenadas GPS</p>
                            <p className="text-sm text-gray-400 mt-1">El cliente usó dirección de texto</p>
                            {request.origin_references && (
                                <div className="bg-white/5 rounded-xl p-3 mt-4 text-left">
                                    <p className="text-sm text-gray-300">{request.origin_references}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
