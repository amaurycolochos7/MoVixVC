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
import { MapPin, Navigation, Loader2, CheckCircle2, Car, Bike, X, User, Timer, ArrowLeft, ArrowRight, Banknote, CircleDot } from "lucide-react";

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
    const [estimatedPrice, setEstimatedPrice] = useState<number>(25); // $20 service + $5 commission
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
            setEstimatedPrice(25); // Fixed price: $20 service + $5 app
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

    // Countdown timer - uses server time for sync with driver
    useEffect(() => {
        if (!createdRequestId || requestExpired) return;

        const fetchServerCountdown = async () => {
            try {
                // Get server time
                const { data: serverTime } = await supabase.rpc('get_server_time');

                // Get request data
                const { data: requestData } = await supabase
                    .from("service_requests")
                    .select("request_expires_at, created_at")
                    .eq("id", createdRequestId)
                    .single();

                if (requestData && serverTime) {
                    // Calculate remaining using server time
                    const serverNow = new Date(serverTime).getTime();
                    const expiresAt = new Date(requestData.request_expires_at).getTime();
                    const initialRemaining = Math.max(0, Math.ceil((expiresAt - serverNow) / 1000));

                    setCountdown(initialRemaining);
                    const mountTime = Date.now();
                    console.log(`⏱️ [CLIENT MOTO] Server remaining_seconds: ${initialRemaining}`);

                    const timer = setInterval(() => {
                        const elapsedSinceMount = (Date.now() - mountTime) / 1000;
                        const remaining = Math.max(0, Math.round(initialRemaining - elapsedSinceMount));
                        setCountdown(remaining);

                        if (remaining <= 0) {
                            clearInterval(timer);
                            setRequestExpired(true);
                            toast.error("Solicitud expirada - Ningún conductor aceptó");
                        }
                    }, 1000);

                    return () => clearInterval(timer);
                }
            } catch (err) {
                console.error('Error fetching server time:', err);
                // Fallback to local countdown
                setCountdown(70);
                const startTime = Date.now();
                const timer = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const remaining = Math.max(0, 70 - elapsed);
                    setCountdown(remaining);
                    if (remaining <= 0) {
                        clearInterval(timer);
                        setRequestExpired(true);
                    }
                }, 1000);
                return () => clearInterval(timer);
            }
        };

        fetchServerCountdown();
    }, [createdRequestId]);

    const handleTryAgain = () => {
        setCreatedRequestId(null);
        setOffers([]);
        setRequestExpired(false);
        setCountdown(70);
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
            serviceType: "moto_ride" as const,
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
            <div className="h-screen overflow-hidden bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 flex flex-col">
                {/* Top section */}
                <div className="pt-14 pb-4 text-white text-center flex-shrink-0">
                    <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white flex items-center justify-center shadow-xl">
                        <Timer className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold">Tiempo agotado</h2>
                    <p className="text-white/80 text-sm mt-1">La solicitud ha expirado</p>
                </div>

                {/* Card section */}
                <div className="flex-1 flex flex-col items-center justify-center px-5">
                    <div className="bg-white rounded-3xl p-6 shadow-2xl w-full max-w-sm text-center">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
                            <X className="w-7 h-7 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Sin respuesta</h3>
                        <p className="text-gray-500 text-sm mb-5">Ningún conductor aceptó en el tiempo límite</p>

                        <Button
                            onClick={handleTryAgain}
                            className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-xl font-bold shadow-lg"
                        >
                            Solicitar de nuevo
                        </Button>

                        <button
                            onClick={() => router.push("/cliente")}
                            className="mt-4 text-gray-400 text-sm font-medium hover:text-gray-600"
                        >
                            Volver al inicio
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Waiting for offers screen
    if (createdRequestId) {
        return (
            <div className="h-screen overflow-hidden bg-gradient-to-b from-orange-500 to-amber-400 flex flex-col">
                {/* Header - Compact */}
                <div className="px-4 pt-10 pb-6 text-white text-center flex-shrink-0">
                    <div className="relative w-20 h-20 mx-auto mb-3">
                        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-xl">
                            <img src="/moto-ride.png" alt="Moto Ride" className="w-14 h-14 object-contain" />
                        </div>
                        <div className="absolute inset-0 rounded-full border-4 border-white/40 animate-ping" />
                    </div>
                    <h2 className="text-xl font-bold">
                        {offers.length > 0 ? "¡Ofertas recibidas!" : "Buscando conductores..."}
                    </h2>
                    <p className="text-white/80 text-xs mt-1">
                        {offers.length > 0 ? `${offers.length} conductor(es) disponible(s)` : "Notificando a motos cercanas"}
                    </p>
                    {/* Countdown */}
                    <div className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-base ${countdown <= 15 ? 'bg-red-500' : 'bg-white/25'}`}>
                        <Timer className="w-4 h-4" />
                        <span>{countdown}s</span>
                    </div>
                </div>

                {/* Content - Compact */}
                <div className="flex-1 bg-gray-50 rounded-t-3xl px-4 pt-4 pb-20 flex flex-col">
                    {offers.length > 0 ? (
                        <div className="space-y-2 flex-1 overflow-y-auto">
                            {offers.map((offer) => (
                                <div key={offer.id} className="bg-white rounded-xl p-3 border border-orange-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                                                <User className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{offer.driver?.full_name || "Conductor"}</p>
                                                <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Verificado
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-black text-orange-500">${offer.offered_price}</p>
                                    </div>
                                    <Button
                                        className="w-full h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg font-bold text-sm"
                                        onClick={() => handleAcceptOffer(offer.id, offer.driver_id, offer.offered_price)}
                                        disabled={acceptingOffer === offer.id}
                                    >
                                        {acceptingOffer === offer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aceptar oferta"}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center pt-2 pb-4">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-orange-100 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                            </div>
                            <p className="text-gray-600 font-medium text-sm">Esperando ofertas...</p>
                            <p className="text-gray-400 text-xs">Esto puede tardar unos segundos</p>
                        </div>
                    )}

                    {/* Destination */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mt-2">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase">Tu destino</p>
                        <p className="font-bold text-gray-900 text-sm">{destinationText}</p>
                    </div>
                </div>

                {/* Fixed Cancel button */}
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100">
                    <button
                        className="w-full py-3 text-red-500 font-bold rounded-xl border-2 border-red-200 hover:bg-red-50 transition-colors"
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
        <div className="h-screen overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
            {/* Header with Gradient - Compact */}
            <div className="bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 px-4 pt-10 pb-12 rounded-b-[2rem] flex-shrink-0">
                <button onClick={() => router.back()} className="flex items-center gap-1 text-white/80 hover:text-white mb-2 transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-xs font-medium">Volver</span>
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg">
                        <img src="/moto-ride.png" alt="Moto Ride" className="w-10 h-10 object-contain" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Moto Ride</h1>
                        <p className="text-white/80 text-xs">Viaje rápido y económico</p>
                    </div>
                </div>
            </div>

            {/* Content - Compact */}
            <div className="px-4 -mt-6 flex-1 flex flex-col gap-3">
                {/* Route Card */}
                <div className="bg-white rounded-2xl p-4 shadow-lg shadow-gray-200/50 border border-gray-100">
                    {/* Origin */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-0.5">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm" />
                            <div className="w-0.5 flex-1 bg-gradient-to-b from-emerald-300 to-orange-300 my-1 min-h-[2.5rem]" />
                        </div>
                        <div className="flex-1 pb-2">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">¿Cuál es tu ubicación?</p>
                            {originCoords || locationState.status === "success" ? (
                                <div className="space-y-2">
                                    <div className="bg-emerald-50 rounded-xl p-2 border border-emerald-100">
                                        <p className="font-medium text-gray-900 text-sm">
                                            {originCoords ? originText || "Ubicación en mapa" : geocodedAddress?.street || "Tu ubicación GPS"}
                                        </p>
                                        <button
                                            className="text-[10px] text-orange-500 font-medium mt-0.5 hover:text-orange-600"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOriginCoords(null);
                                                setOriginText("");
                                                setLocationState({ status: "idle", coords: null, error: null });
                                                setGeocodedAddress(null);
                                            }}
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Referencias: Ej. Casa azul..."
                                        value={originReference}
                                        onChange={(e) => setOriginReference(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            ) : locationState.status === "loading" ? (
                                <div className="flex items-center gap-2 text-gray-500 bg-gray-50 rounded-xl p-2">
                                    <Loader2 className="w-3 h-3 animate-spin text-orange-500" />
                                    <span className="text-xs">Obteniendo ubicación...</span>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowOriginMapPicker(true)}
                                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-2 text-gray-400 text-sm transition-colors"
                                >
                                    Toca para seleccionar origen
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Destination */}
                    <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-0.5">
                            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-orange-400 to-red-500 shadow-sm" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">¿A dónde vas?</p>
                            {destinationCoords ? (
                                <div className="space-y-2">
                                    <div className="bg-orange-50 rounded-xl p-2 border border-orange-100">
                                        <p className="font-medium text-gray-900 text-sm">{destinationText}</p>
                                        <button
                                            className="text-[10px] text-orange-500 font-medium mt-0.5 hover:text-orange-600"
                                            onClick={() => setShowMapPicker(true)}
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Referencias: Ej. Edificio blanco..."
                                        value={destinationReference}
                                        onChange={(e) => setDestinationReference(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowMapPicker(true)}
                                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-2 text-gray-400 text-sm transition-colors"
                                >
                                    Toca para seleccionar destino
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* GPS Button - Compact */}
                {!originCoords && locationState.status !== "success" && locationState.status !== "loading" && (
                    <button
                        onClick={requestLocation}
                        className="w-full bg-white rounded-xl p-3 shadow-md flex items-center gap-3 hover:shadow-lg transition-all border border-gray-100"
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                            <Navigation className="h-5 w-5 text-white" />
                        </div>
                        <div className="text-left">
                            <span className="font-bold text-gray-900 text-sm">Usar mi ubicación actual</span>
                            <p className="text-[10px] text-gray-500">Detectar con GPS</p>
                        </div>
                    </button>
                )}

                {/* Error state */}
                {locationState.status === "error" && (
                    <div className="bg-red-50 rounded-xl p-3 flex items-center gap-2 border border-red-100">
                        <MapPin className="w-4 h-4 text-red-500" />
                        <span className="text-xs text-red-600 font-medium">{locationState.error}</span>
                    </div>
                )}

                {/* Price Card - Compact */}
                {destinationCoords && effectiveOriginCoords && (
                    <div className="bg-white rounded-xl p-3 shadow-md border border-gray-100">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <span className="bg-orange-100 text-orange-600 text-[9px] font-bold px-2 py-0.5 rounded-full">RECOMENDADO</span>
                                <h3 className="font-bold text-gray-900 text-base mt-0.5">Moto Económica</h3>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                <span className="flex items-center gap-0.5">
                                    <Timer className="w-2.5 h-2.5" />
                                    {routeETA} min
                                </span>
                                <span>•</span>
                                <span>{routeDistance.toFixed(1)} km</span>
                            </div>
                        </div>

                        {/* Price Breakdown - Updated pricing */}
                        <div className="bg-gray-50 rounded-lg p-2 space-y-1 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Costo del servicio</span>
                                <span className="font-semibold text-gray-900">$20.00</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Comisión de app</span>
                                <span className="font-semibold text-gray-900">$5.00</span>
                            </div>
                            <div className="border-t border-gray-200 pt-1 flex justify-between items-center">
                                <span className="font-bold text-gray-900">Total</span>
                                <span className="text-xl font-black text-orange-500">${estimatedPrice}.00</span>
                            </div>
                        </div>

                        {/* Payment method */}
                        <div className="flex items-center justify-end mt-2">
                            <div className="flex items-center gap-1 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                                <Banknote className="w-2.5 h-2.5" />
                                Efectivo
                            </div>
                        </div>
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100">
                        {error}
                    </div>
                )}
            </div>

            {/* Fixed Bottom Button */}
            <div className="fixed bottom-16 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-50">
                <Button
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 rounded-2xl shadow-xl shadow-orange-200"
                    disabled={!isFormValid || isLoading}
                    onClick={handleSubmit}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Buscando conductor...
                        </>
                    ) : (
                        <>
                            Confirmar viaje
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                    )}
                </Button>
                {!isFormValid && (
                    <p className="text-xs text-center text-gray-400 mt-2 font-medium">
                        {!effectiveOriginCoords && "Selecciona tu ubicación de origen"}
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
