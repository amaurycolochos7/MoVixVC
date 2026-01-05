"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useRequestWizard } from "@/hooks/useRequestWizard";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { reverseGeocode, ReverseGeocodeResult } from "@/lib/mapbox";
import { LocationPickerMap } from "@/components/maps/location-picker-map";
import { MapPin, Navigation, Loader2, CheckCircle2, Car, X, DollarSign, User, Timer, Search, ArrowRight, Wallet, Banknote } from "lucide-react";

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
    const [estimatedPrice, setEstimatedPrice] = useState<number>(33); // Base fare
    const [routeDistance, setRouteDistance] = useState<number>(0); // km
    const [routeETA, setRouteETA] = useState<number>(0); // minutes
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet'>('cash');

    const [offers, setOffers] = useState<any[]>([]);
    const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
    const [requestExpired, setRequestExpired] = useState(false);
    const [countdown, setCountdown] = useState(25);
    const [geocodedAddress, setGeocodedAddress] = useState<ReverseGeocodeResult | null>(null);
    const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [showOriginMapPicker, setShowOriginMapPicker] = useState(false);
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [originCoords, setOriginCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [originText, setOriginText] = useState("");

    // Get effective origin coordinates (manual or GPS)
    const effectiveOriginCoords = originCoords || locationState.coords;

    // Calculate price when destination changes
    useEffect(() => {
        if (!effectiveOriginCoords || !destinationCoords) return;

        const calculateDistance = () => {
            const R = 6371; // Earth radius in km
            const dLat = (destinationCoords.lat - effectiveOriginCoords.lat) * Math.PI / 180;
            const dLon = (destinationCoords.lng - effectiveOriginCoords.lng) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(effectiveOriginCoords.lat * Math.PI / 180) * Math.cos(destinationCoords.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            setRouteDistance(distance);

            // Calculate ETA (assuming 30 km/h average)
            const eta = Math.ceil((distance / 30) * 60); // minutes
            setRouteETA(eta);

            // Calculate price: Base 33 + 8 pesos per km
            const price = Math.ceil(33 + (distance * 8));
            setEstimatedPrice(price);
        };

        calculateDistance();
    }, [effectiveOriginCoords, destinationCoords]);

    // Subscribe to offers when request is created
    useEffect(() => {
        if (!createdRequestId) return;

        // Check if request was assigned (driver accepted directly)
        const checkRequestStatus = async () => {
            const { data, error } = await supabase
                .from("service_requests")
                .select("status, assigned_driver_id")
                .eq("id", createdRequestId)
                .single();

            if (error) {
                console.error("❌ Error checking request status:", error);
                return;
            }

            // If request is assigned or in_progress, redirect to tracking
            if ((data?.status === "assigned" || data?.status === "in_progress") && data?.assigned_driver_id) {
                toast.success("¡Conductor asignado!");
                router.push(`/cliente/tracking/${createdRequestId}`);
            }
        };

        // Fetch existing offers
        const fetchOffers = async () => {
            const { data, error } = await supabase
                .from("offers")
                .select("*, driver:users(full_name)")
                .eq("request_id", createdRequestId)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("❌ Error fetching initial offers:", error);
                return;
            }

            if (data && data.length > 0) {
                setOffers(prev => {
                    const newIds = data.map(o => o.id).sort().join(',');
                    const prevIds = prev.map(o => o.id).sort().join(',');
                    if (newIds !== prevIds) {
                        return data;
                    }
                    return prev;
                });
            }
        };

        // Initial fetch
        fetchOffers();
        checkRequestStatus();

        // Polling as backup (every 3 seconds)
        const pollInterval = setInterval(() => {
            fetchOffers();
            checkRequestStatus();
        }, 3000);

        // Subscribe to new offers (Realtime)
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

                    if (error) {
                        console.error("❌ Error fetching offer details:", error);
                        return;
                    }

                    if (data) {
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

    // Countdown timer for request expiration (25 seconds)
    useEffect(() => {
        if (!createdRequestId || requestExpired) return;

        setCountdown(25);
        const startTime = Date.now();

        const timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, 25 - elapsed);
            setCountdown(remaining);

            if (remaining <= 0) {
                clearInterval(timer);
                setRequestExpired(true);
                toast.error("Solicitud expirada - Ningún conductor aceptó");
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [createdRequestId]);

    // Handle "try again" after expiration
    const handleTryAgain = () => {
        setCreatedRequestId(null);
        setOffers([]);
        setRequestExpired(false);
        setCountdown(25);
    };

    // Accept an offer
    const handleAcceptOffer = async (offerId: string, driverId: string, offeredPrice: number) => {
        setAcceptingOffer(offerId);
        try {
            await supabase
                .from("offers")
                .update({ status: "accepted" })
                .eq("id", offerId);

            await supabase
                .from("service_requests")
                .update({
                    status: "assigned",
                    assigned_driver_id: driverId,
                    final_price: offeredPrice
                })
                .eq("id", createdRequestId);

            toast.success("Conductor asignado");
            router.push(`/cliente/tracking/${createdRequestId}`);
        } catch (err) {
            toast.error("Error al aceptar oferta");
        } finally {
            setAcceptingOffer(null);
        }
    };

    // Request GPS location
    const requestLocation = () => {
        if (!navigator.geolocation) {
            setLocationState({
                status: "error",
                coords: null,
                error: "Tu navegador no soporta geolocalización",
            });
            return;
        }

        setLocationState({ status: "loading", coords: null, error: null });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setLocationState({
                    status: "success",
                    coords: coords,
                    error: null,
                });

                // Reverse geocode to get address
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
                if (geoError.code === geoError.PERMISSION_DENIED) {
                    errorMsg = "Permiso de ubicación denegado";
                } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
                    errorMsg = "Ubicación no disponible";
                } else if (geoError.code === geoError.TIMEOUT) {
                    errorMsg = "Tiempo de espera agotado";
                }
                setLocationState({ status: "error", coords: null, error: errorMsg });
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 60000 }
        );
    };

    // Valid if we have origin (GPS or manual) AND destination
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
                address_references: "",
            },
            notes: "",
            offerPrice: estimatedPrice.toString(),
        };

        const result = await submitRequest(requestData);

        if (result) {
            setCreatedRequestId(result.id);
        }
    };

    // Show searching animation if request was created
    if (createdRequestId) {
        if (requestExpired) {
            return (
                <div className="min-h-[80vh] p-4 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                        <Timer className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-red-600">Solicitud Expirada</h2>
                        <p className="text-sm text-text-secondary mt-2">
                            Ningún conductor aceptó en el tiempo límite
                        </p>
                    </div>
                    <Button onClick={handleTryAgain} className="w-full max-w-xs">
                        Solicitar de nuevo
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/cliente")} className="w-full max-w-xs">
                        Volver al inicio
                    </Button>
                </div>
            );
        }

        return (
            <div className="min-h-[80vh] p-4">
                {/* Header with countdown */}
                <div className="text-center mb-6">
                    <div className="relative w-20 h-20 mx-auto mb-4">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                            <Car className="w-10 h-10 text-primary" />
                        </div>
                        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                    </div>
                    <h2 className="text-xl font-bold">
                        {offers.length > 0 ? "Ofertas recibidas" : "Buscando conductores..."}
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                        {offers.length > 0
                            ? `${offers.length} conductor(es) disponible(s)`
                            : "Notificando a taxis cercanos"
                        }
                    </p>

                    {/* Countdown Timer */}
                    <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${countdown <= 10 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        <Timer className="w-4 h-4" />
                        <span className="font-bold text-lg">{countdown}s</span>
                        <span className="text-sm">restantes</span>
                    </div>
                </div>

                {/* Offers List */}
                {offers.length > 0 ? (
                    <div className="space-y-3 mb-6">
                        {offers.map((offer) => (
                            <Card key={offer.id} className="p-4 border-2 border-primary/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                            <User className="w-6 h-6 text-gray-500" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">
                                                {offer.driver?.full_name || "Conductor"}
                                            </p>
                                            <p className="text-sm text-text-secondary">
                                                Conductor verificado
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-primary">
                                            ${offer.offered_price}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    className="w-full mt-3"
                                    onClick={() => handleAcceptOffer(offer.id, offer.driver_id, offer.offered_price)}
                                    disabled={acceptingOffer === offer.id}
                                >
                                    {acceptingOffer === offer.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                    )}
                                    Aceptar oferta
                                </Button>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
                        <p className="text-sm text-text-secondary">
                            Esperando ofertas de conductores...
                        </p>
                    </div>
                )}

                {/* Destination reminder */}
                <Card className="p-3 bg-surface-elevated mb-4">
                    <p className="text-xs text-text-secondary">Destino</p>
                    <p className="font-medium">{destinationText}</p>
                </Card>

                {/* Cancel button */}
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                        await supabase
                            .from("service_requests")
                            .update({ status: "cancelled" })
                            .eq("id", createdRequestId);
                        setCreatedRequestId(null);
                        setOffers([]);
                        toast.info("Solicitud cancelada");
                    }}
                >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar solicitud
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-20">
            <h1 className="text-2xl font-bold">Solicitar Taxi</h1>

            {/* === ORIGIN SECTION === */}
            <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                    <Navigation className="w-5 h-5" />
                    <span>¿Dónde te recogemos?</span>
                </div>

                {/* Show selected origin if we have one */}
                {(originCoords || locationState.status === "success") ? (
                    <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-green-800">Punto de recogida:</p>
                                    <p className="text-sm text-green-700 mt-1">
                                        {originCoords
                                            ? originText || "Ubicación seleccionada en mapa"
                                            : geocodedAddress?.street || geocodedAddress?.neighborhood || "Tu ubicación GPS"
                                        }
                                    </p>
                                    <p className="text-xs text-green-600 mt-1">
                                        {originCoords ? "📍 Seleccionado en mapa" : "📡 Via GPS"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Change origin buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => {
                                    setOriginCoords(null);
                                    setOriginText("");
                                    setLocationState({ status: "idle", coords: null, error: null });
                                    setGeocodedAddress(null);
                                }}
                            >
                                Cambiar ubicación
                            </Button>
                        </div>

                        {/* Reference field */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Referencias para el conductor (opcional):
                            </label>
                            <Textarea
                                placeholder='Ej: "Frente al Oxxo", "Casa azul con portón negro"'
                                value={originReference}
                                onChange={(e) => setOriginReference(e.target.value)}
                                rows={2}
                                className="resize-none"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Selecciona dónde te van a recoger
                        </p>

                        {/* GPS Loading state */}
                        {locationState.status === "loading" && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                <span className="text-sm text-blue-700">Obteniendo ubicación...</span>
                            </div>
                        )}

                        {/* GPS Error state */}
                        {locationState.status === "error" && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 mb-3">
                                <MapPin className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <span className="text-sm text-red-600 flex-1">{locationState.error}</span>
                            </div>
                        )}

                        {/* Two options: GPS or Manual */}
                        {locationState.status !== "loading" && (
                            <div className="grid grid-cols-1 gap-3">
                                {/* GPS Auto button */}
                                <Button
                                    className="w-full h-14"
                                    size="lg"
                                    onClick={requestLocation}
                                >
                                    <Navigation className="w-5 h-5 mr-2" />
                                    Usar mi ubicación actual (GPS)
                                </Button>

                                {/* Divider */}
                                <div className="flex items-center gap-3">
                                    <div className="h-px bg-gray-200 flex-1" />
                                    <span className="text-xs text-gray-400 font-medium">O</span>
                                    <div className="h-px bg-gray-200 flex-1" />
                                </div>

                                {/* Manual map button */}
                                <Button
                                    className="w-full h-14"
                                    size="lg"
                                    variant="outline"
                                    onClick={() => setShowOriginMapPicker(true)}
                                >
                                    <MapPin className="w-5 h-5 mr-2" />
                                    Seleccionar en el mapa
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* === DESTINATION SECTION === */}
            <Card className="p-5 space-y-4">
                <div className="flex items-center gap-2 text-primary font-semibold">
                    <Search className="w-5 h-5" />
                    <span>¿A dónde vas?</span>
                </div>

                {!destinationCoords ? (
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Selecciona tu destino en el mapa para ver el precio estimado
                        </p>
                        <Button
                            className="w-full h-14"
                            size="lg"
                            variant="outline"
                            onClick={() => setShowMapPicker(true)}
                        >
                            <MapPin className="w-5 h-5 mr-2" />
                            Seleccionar destino en mapa
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-green-800">Destino seleccionado:</p>
                                    <p className="text-sm text-green-700 mt-1">{destinationText}</p>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowMapPicker(true)}
                        >
                            Cambiar destino
                        </Button>
                    </div>
                )}
            </Card>

            {/* === SERVICE CARD (ECONÓMICO) === */}
            {destinationCoords && locationState.coords && (
                <Card className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 text-white border-0 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold">Económico</h3>
                                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">
                                    POPULAR
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-300">
                                <span className="flex items-center gap-1">
                                    <Timer className="w-4 h-4" />
                                    {routeETA} min
                                </span>
                                <span>•</span>
                                <span>{routeDistance.toFixed(1)} km</span>
                            </div>
                        </div>
                        <div className="w-16 h-16">
                            <Car className="w-full h-full text-white/80" />
                        </div>
                    </div>

                    <div className="h-px bg-white/20 my-4" />

                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">
                                Precio estimado
                            </p>
                            <p className="text-4xl font-black tracking-tight">
                                ${estimatedPrice}
                            </p>
                        </div>
                        <div className="text-right text-xs text-gray-400">
                            <p>Tarifa base: $33</p>
                            <p>+ ${(estimatedPrice - 33).toFixed(0)} por distancia</p>
                        </div>
                    </div>
                </Card>
            )}

            {/* === PAYMENT METHODS === */}
            {destinationCoords && (
                <Card className="p-5 space-y-4">
                    <h3 className="font-semibold text-gray-900">Método de pago</h3>

                    {/* Cash Option */}
                    <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${paymentMethod === 'cash'
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-primary text-white' : 'bg-gray-100'
                                }`}>
                                <Banknote className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-gray-900">Efectivo</p>
                                <p className="text-xs text-gray-500">Paga al conductor</p>
                            </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cash' ? 'border-primary' : 'border-gray-300'
                            }`}>
                            {paymentMethod === 'cash' && (
                                <div className="w-3 h-3 rounded-full bg-primary" />
                            )}
                        </div>
                    </button>

                    {/* Wallet Option (Disabled) */}
                    <button
                        disabled
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="text-left">
                                <p className="font-semibold text-gray-700">Créditos MoVix</p>
                                <p className="text-xs text-gray-500">Próximamente</p>
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            PRÓXIMAMENTE
                        </span>
                    </button>
                </Card>
            )}

            {/* Error display */}
            {error && (
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* === SUBMIT BUTTON === */}
            <Button
                className="w-full h-14 text-lg font-bold shadow-xl"
                size="lg"
                disabled={!isFormValid || isLoading}
                onClick={handleSubmit}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Enviando solicitud...
                    </>
                ) : (
                    <>
                        CONFIRMAR VIAJE
                        <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                )}
            </Button>

            {!isFormValid && (
                <p className="text-xs text-center text-gray-500">
                    {!effectiveOriginCoords && "📍 Selecciona dónde te recogen"}
                    {effectiveOriginCoords && !destinationCoords && "🎯 Selecciona tu destino en el mapa"}
                </p>
            )}

            {/* Destination Map Picker Modal */}
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

            {/* Origin Map Picker Modal */}
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
