"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRequestWizard } from "@/hooks/useRequestWizard";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { reverseGeocode, ReverseGeocodeResult } from "@/lib/mapbox";
import { LocationPickerMap } from "@/components/maps/location-picker-map";
import { MapPin, Navigation, Loader2, CheckCircle2, Car, X, User, Timer, ArrowLeft, ArrowRight, Banknote, CircleDot } from "lucide-react";

type LocationState = {
    status: "idle" | "loading" | "success" | "error";
    coords: { lat: number; lng: number } | null;
    error: string | null;
};

export default function TaxiWizardPage() {
    const router = useRouter();
    const { submitRequest, isLoading, error } = useRequestWizard();
    const supabase = createClient();

    const [locationState, setLocationState] = useState<LocationState>({
        status: "idle",
        coords: null,
        error: null,
    });
    const [originReference, setOriginReference] = useState("");
    const [destinationText, setDestinationText] = useState("");
    const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

    // Pricing and route state
    const [estimatedPrice, setEstimatedPrice] = useState<number>(35);
    const [routeDistance, setRouteDistance] = useState<number>(0);
    const [routeETA, setRouteETA] = useState<number>(0);

    const [offers, setOffers] = useState<any[]>([]);
    const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
    const [requestExpired, setRequestExpired] = useState(false);
    const [countdown, setCountdown] = useState(40);
    const [geocodedAddress, setGeocodedAddress] = useState<ReverseGeocodeResult | null>(null);
    const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showOriginMapPicker, setShowOriginMapPicker] = useState(false);
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [destinationReference, setDestinationReference] = useState("");
    const [originCoords, setOriginCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [originText, setOriginText] = useState("");

    const effectiveOriginCoords = originCoords || locationState.coords;

    // Calculate price when destination changes
    useEffect(() => {
        if (!effectiveOriginCoords || !destinationCoords) return;

        const calculateDistance = () => {
            const R = 6371;
            const dLat = (destinationCoords.lat - effectiveOriginCoords.lat) * Math.PI / 180;
            const dLon = (destinationCoords.lng - effectiveOriginCoords.lng) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(effectiveOriginCoords.lat * Math.PI / 180) * Math.cos(destinationCoords.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            setRouteDistance(distance);
            const eta = Math.ceil((distance / 30) * 60);
            setRouteETA(eta);
            setEstimatedPrice(35);
        };

        calculateDistance();
    }, [effectiveOriginCoords, destinationCoords]);

    // Subscribe to offers when request is created
    useEffect(() => {
        if (!createdRequestId) return;

        const checkRequestStatus = async () => {
            const { data, error } = await supabase
                .from("service_requests")
                .select("status, assigned_driver_id")
                .eq("id", createdRequestId)
                .single();

            if (error) return;

            if ((data?.status === "assigned" || data?.status === "in_progress") && data?.assigned_driver_id) {
                toast.success("¡Conductor asignado!");
                router.push(`/cliente/tracking/${createdRequestId}`);
            }
        };

        const fetchOffers = async () => {
            const { data, error } = await supabase
                .from("offers")
                .select("*, driver:users(full_name)")
                .eq("request_id", createdRequestId)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) return;

            if (data && data.length > 0) {
                setOffers(prev => {
                    const newIds = data.map(o => o.id).sort().join(',');
                    const prevIds = prev.map(o => o.id).sort().join(',');
                    if (newIds !== prevIds) return data;
                    return prev;
                });
            }
        };

        fetchOffers();
        checkRequestStatus();

        const pollInterval = setInterval(() => {
            fetchOffers();
            checkRequestStatus();
        }, 3000);

        const channel = supabase
            .channel(`offers-${createdRequestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'offers',
                    filter: `request_id=eq.${createdRequestId}`
                },
                async (payload) => {
                    const { data, error } = await supabase
                        .from("offers")
                        .select("*, driver:users(full_name)")
                        .eq("id", payload.new.id)
                        .single();

                    if (!error && data) {
                        setOffers(prev => {
                            if (prev.some(o => o.id === data.id)) return prev;
                            return [data, ...prev];
                        });
                        toast.success("Nueva oferta recibida");
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [createdRequestId, router]);

    // Countdown timer
    useEffect(() => {
        if (!createdRequestId || requestExpired) return;

        setCountdown(40);
        const startTime = Date.now();

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, 40 - elapsed);
            setCountdown(remaining);

            if (remaining <= 0) {
                clearInterval(timer);
                setRequestExpired(true);
                toast.error("Solicitud expirada - Ningún conductor aceptó");
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [createdRequestId]);

    const handleTryAgain = () => {
        setCreatedRequestId(null);
        setOffers([]);
        setRequestExpired(false);
        setCountdown(40);
    };

    const handleAcceptOffer = async (offerId: string, driverId: string, offeredPrice: number) => {
        setAcceptingOffer(offerId);
        try {
            await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);
            await supabase.from("service_requests").update({
                status: "assigned",
                assigned_driver_id: driverId,
                final_price: offeredPrice
            }).eq("id", createdRequestId);

            toast.success("Conductor asignado");
            router.push(`/cliente/tracking/${createdRequestId}`);
        } catch (err) {
            toast.error("Error al aceptar oferta");
        } finally {
            setAcceptingOffer(null);
        }
    };

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setLocationState({ status: "error", coords: null, error: "Tu navegador no soporta geolocalización" });
            return;
        }

        setLocationState({ status: "loading", coords: null, error: null });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                setLocationState({ status: "success", coords: coords, error: null });

                setIsGeocodingAddress(true);
                try {
                    const address = await reverseGeocode(coords);
                    setGeocodedAddress(address);
                } catch (err) {
                    console.error("Error reverse geocoding:", err);
                } finally {
                    setIsGeocodingAddress(false);
                }
            },
            (geoError) => {
                let errorMsg = "No se pudo obtener tu ubicación";
                if (geoError.code === geoError.PERMISSION_DENIED) errorMsg = "Permiso de ubicación denegado";
                else if (geoError.code === geoError.POSITION_UNAVAILABLE) errorMsg = "Ubicación no disponible";
                else if (geoError.code === geoError.TIMEOUT) errorMsg = "Tiempo de espera agotado";
                setLocationState({ status: "error", coords: null, error: errorMsg });
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
        );
    };

    const isFormValid = (locationState.status === "success" || originCoords !== null) && destinationCoords !== null;

    const handleSubmit = async () => {
        const requestData = {
            serviceType: "taxi" as const,
            origin: {
                address: originText || geocodedAddress?.street || "Tu ubicación",
                lat: effectiveOriginCoords?.lat || 0,
                lng: effectiveOriginCoords?.lng || 0,
                address_references: originReference,
            },
            destination: {
                address: destinationText,
                lat: destinationCoords?.lat || 0,
                lng: destinationCoords?.lng || 0,
                address_references: destinationReference,
            },
            notes: "",
            offerPrice: estimatedPrice.toString(),
        };

        const result = await submitRequest(requestData);
        if (result) setCreatedRequestId(result.id);
    };

    // Request expired screen
    if (createdRequestId && requestExpired) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
                    <Timer className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Solicitud Expirada</h2>
                <p className="text-gray-500 mb-8">Ningún conductor aceptó en el tiempo límite</p>
                <Button onClick={handleTryAgain} className="w-full max-w-xs h-12 bg-blue-500 hover:bg-blue-600">
                    Solicitar de nuevo
                </Button>
                <button onClick={() => router.push("/cliente")} className="mt-4 text-gray-500 text-sm">
                    Volver al inicio
                </button>
            </div>
        );
    }

    // Waiting for offers screen
    if (createdRequestId) {
        return (
            <div className="min-h-screen bg-white">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 pt-12 pb-8 text-white text-center">
                    <div className="relative w-20 h-20 mx-auto mb-4">
                        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
                            <Car className="w-10 h-10 text-white" />
                        </div>
                        <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
                    </div>
                    <h2 className="text-xl font-bold">
                        {offers.length > 0 ? "Ofertas recibidas" : "Buscando conductores..."}
                    </h2>
                    <p className="text-white/80 text-sm mt-1">
                        {offers.length > 0 ? `${offers.length} conductor(es) disponible(s)` : "Notificando a taxis cercanos"}
                    </p>

                    {/* Countdown */}
                    <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${countdown <= 10 ? 'bg-red-500' : 'bg-white/20'}`}>
                        <Timer className="w-4 h-4" />
                        <span className="font-bold text-lg">{countdown}s</span>
                    </div>
                </div>

                <div className="p-4">
                    {/* Offers List */}
                    {offers.length > 0 ? (
                        <div className="space-y-3 mb-6">
                            {offers.map((offer) => (
                                <div key={offer.id} className="bg-white rounded-2xl p-4 border-2 border-blue-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                                <User className="w-6 h-6 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">{offer.driver?.full_name || "Conductor"}</p>
                                                <p className="text-xs text-gray-500">Conductor verificado</p>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-600">${offer.offered_price}</p>
                                    </div>
                                    <Button
                                        className="w-full h-12 bg-blue-500 hover:bg-blue-600"
                                        onClick={() => handleAcceptOffer(offer.id, offer.driver_id, offer.offered_price)}
                                        disabled={acceptingOffer === offer.id}
                                    >
                                        {acceptingOffer === offer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceptar oferta"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
                            <p className="text-gray-500">Esperando ofertas de conductores...</p>
                        </div>
                    )}

                    {/* Destination reminder */}
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <p className="text-xs text-gray-500 mb-1">Destino</p>
                        <p className="font-medium text-gray-900">{destinationText}</p>
                    </div>

                    {/* Cancel button */}
                    <button
                        className="w-full py-3 text-red-500 font-medium"
                        onClick={async () => {
                            await supabase.from("service_requests").update({ status: "cancelled" }).eq("id", createdRequestId);
                            setCreatedRequestId(null);
                            setOffers([]);
                            toast.info("Solicitud cancelada");
                        }}
                    >
                        Cancelar solicitud
                    </button>
                </div>
            </div>
        );
    }

    // Main form
    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <div className="bg-white px-5 pt-12 pb-6 shadow-sm">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 mb-4">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Solicitar Taxi</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Route Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm">
                    {/* Origin */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <div className="w-0.5 flex-1 bg-gray-200 my-1 min-h-[3rem]" />
                        </div>
                        <div className="flex-1 pb-4">
                            <p className="text-xs text-gray-500 font-medium mb-1">¿Cuál es tu ubicación?</p>
                            {originCoords || locationState.status === "success" ? (
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {originCoords ? originText || "Ubicación en mapa" : geocodedAddress?.street || "Tu ubicación GPS"}
                                        </p>
                                        <button
                                            className="text-xs text-blue-500 mt-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOriginCoords(null);
                                                setOriginText("");
                                                setLocationState({ status: "idle", coords: null, error: null });
                                                setGeocodedAddress(null);
                                            }}
                                        >
                                            Cambiar ubicación
                                        </button>
                                    </div>
                                    {/* Reference input for origin */}
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Referencias: Ej. Casa azul, frente al Oxxo..."
                                            value={originReference}
                                            onChange={(e) => setOriginReference(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            ) : locationState.status === "loading" ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Obteniendo ubicación...</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowOriginMapPicker(true)}
                                    className="text-gray-400 hover:text-gray-600 text-left"
                                >
                                    Selecciona tu ubicación de origen
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Destination */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 font-medium mb-1">¿A dónde vas?</p>
                            {destinationCoords ? (
                                <div className="space-y-3">
                                    <div>
                                        <p className="font-medium text-gray-900">{destinationText}</p>
                                        <button
                                            className="text-xs text-blue-500 mt-1"
                                            onClick={() => setShowMapPicker(true)}
                                        >
                                            Cambiar destino
                                        </button>
                                    </div>
                                    {/* Reference input for destination */}
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Referencias: Ej. Edificio blanco, junto al parque..."
                                            value={destinationReference}
                                            onChange={(e) => setDestinationReference(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowMapPicker(true)}
                                    className="text-gray-400 hover:text-gray-600 text-left"
                                >
                                    Selecciona tu destino
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* GPS Button (only if no origin selected) */}
                {!originCoords && locationState.status !== "success" && locationState.status !== "loading" && (
                    <button
                        onClick={requestLocation}
                        className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Navigation className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">Usar mi ubicación actual</span>
                    </button>
                )}

                {/* Error state */}
                {locationState.status === "error" && (
                    <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-red-600">{locationState.error}</span>
                    </div>
                )}

                {/* Price Card */}
                {destinationCoords && effectiveOriginCoords && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Económico</h3>
                                <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Timer className="w-4 h-4" />
                                        {routeETA} min
                                    </span>
                                    <span>•</span>
                                    <span>{routeDistance.toFixed(1)} km</span>
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Car className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>

                        <div className="flex items-end justify-between pt-4 border-t border-gray-100">
                            <div>
                                <p className="text-xs text-gray-500">Precio estimado</p>
                                <p className="text-3xl font-bold text-gray-900">${estimatedPrice}</p>
                            </div>
                            <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-medium">
                                <Banknote className="w-4 h-4" />
                                Efectivo
                            </div>
                        </div>
                    </div>
                )}



                {/* Error display */}
                {error && (
                    <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Fixed Bottom Button */}
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
                <Button
                    className="w-full h-14 text-lg font-bold bg-blue-500 hover:bg-blue-600 rounded-xl shadow-lg shadow-blue-200"
                    disabled={!isFormValid || isLoading}
                    onClick={handleSubmit}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Enviando...
                        </>
                    ) : (
                        <>
                            Confirmar viaje
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                    )}
                </Button>
                {!isFormValid && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                        {!effectiveOriginCoords && "Selecciona dónde te recogen"}
                        {effectiveOriginCoords && !destinationCoords && "Selecciona tu destino"}
                    </p>
                )}
            </div>

            {/* Map Pickers */}
            {showMapPicker && (
                <LocationPickerMap
                    initialLocation={destinationCoords || effectiveOriginCoords}
                    onConfirm={(loc) => {
                        setDestinationText(loc.placeName);
                        setDestinationCoords(loc.coords);
                        setShowMapPicker(false);
                    }}
                    onCancel={() => setShowMapPicker(false)}
                />
            )}

            {showOriginMapPicker && (
                <LocationPickerMap
                    initialLocation={originCoords || locationState.coords}
                    onConfirm={(loc) => {
                        setOriginText(loc.placeName);
                        setOriginCoords(loc.coords);
                        setShowOriginMapPicker(false);
                    }}
                    onCancel={() => setShowOriginMapPicker(false)}
                />
            )}
        </div>
    );
}
