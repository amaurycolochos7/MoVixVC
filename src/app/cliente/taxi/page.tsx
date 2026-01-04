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
import { MapPin, Navigation, Loader2, Building2, ShoppingBag, GraduationCap, Cross, Bus, Church, CheckCircle2, Car, X, DollarSign, User, Timer, Map as MapIcon } from "lucide-react";

// Popular destinations - customize for your city
const POPULAR_PLACES = [
    { id: "hospital", name: "Hospital General", icon: Cross },
    { id: "terminal", name: "Terminal de Autobuses", icon: Bus },
    { id: "mercado", name: "Mercado Municipal", icon: ShoppingBag },
    { id: "centro", name: "Centro / Zócalo", icon: Building2 },
    { id: "escuela", name: "Escuela Preparatoria", icon: GraduationCap },
    { id: "iglesia", name: "Iglesia del Centro", icon: Church },
];

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
    const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
    const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
    const [offers, setOffers] = useState<any[]>([]);
    const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
    const [requestExpired, setRequestExpired] = useState(false);
    const [countdown, setCountdown] = useState(25);
    const [geocodedAddress, setGeocodedAddress] = useState<ReverseGeocodeResult | null>(null);
    const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [destinationCoords, setDestinationCoords] = useState<{ lat: number, lng: number } | null>(null);

    // Subscribe to offers when request is created
    useEffect(() => {
        if (!createdRequestId) return;

        // Check if request was assigned (driver accepted directly)
        const checkRequestStatus = async () => {
            console.log("🔍 Checking request status for:", createdRequestId);

            const { data, error } = await supabase
                .from("service_requests")
                .select("status, assigned_driver_id")
                .eq("id", createdRequestId)
                .single();

            if (error) {
                console.error("❌ Error checking request status:", error);
                return;
            }

            console.log("📊 Request status:", data?.status, "Driver:", data?.assigned_driver_id);

            // If request is assigned or in_progress, redirect to tracking
            if ((data?.status === "assigned" || data?.status === "in_progress") && data?.assigned_driver_id) {
                console.log("✅ Request assigned! Redirecting to tracking...");
                toast.success("¡Conductor asignado!");
                router.push(`/cliente/tracking/${createdRequestId}`);
            }
        };

        // Fetch existing offers
        const fetchOffers = async () => {
            console.log("📬 Fetching offers for request:", createdRequestId);

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

            console.log("✅ Offers fetched:", data?.length || 0, "offers", data);
            if (data && data.length > 0) {
                setOffers(prev => {
                    // Only update if we have new offers
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
            console.log("🔄 Polling for offers and status...");
            fetchOffers();
            checkRequestStatus();
        }, 3000);

        // Subscribe to new offers (Realtime)
        console.log("🔌 Subscribing to offers channel:", `offers-${createdRequestId}`);
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
                    console.log("📨 Realtime offer received:", payload);
                    // Fetch offer with driver info
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
                        console.log("✅ Offer details loaded:", data);
                        setOffers(prev => {
                            // Avoid duplicates
                            if (prev.some(o => o.id === data.id)) return prev;
                            return [data, ...prev];
                        });
                        toast.success("Nueva oferta recibida");
                    }
                }
            )
            .subscribe((status) => {
                console.log("📡 Subscription status:", status);
            });

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [createdRequestId, router]);

    // Countdown timer for request expiration (25 seconds)
    useEffect(() => {
        if (!createdRequestId || requestExpired) return;

        setCountdown(25); // Reset countdown
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
            // Update offer status
            await supabase
                .from("offers")
                .update({ status: "accepted" })
                .eq("id", offerId);

            // Update request with assigned driver AND the accepted price
            await supabase
                .from("service_requests")
                .update({
                    status: "assigned",
                    assigned_driver_id: driverId,
                    final_price: offeredPrice // Use the negotiated price
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

    // Manual location request - removed auto-request on mount
    // User must click button to share location

    const handlePlaceSelect = (placeId: string) => {
        if (selectedPlace === placeId) {
            setSelectedPlace(null);
            setDestinationText("");
        } else {
            setSelectedPlace(placeId);
            const place = POPULAR_PLACES.find((p) => p.id === placeId);
            if (place) setDestinationText(place.name);
        }
    };

    const isFormValid =
        (locationState.status === "success" || originReference.trim()) &&
        destinationText.trim();

    const handleSubmit = async () => {
        // Pass data directly to submitRequest to avoid async state issues
        const requestData = {
            serviceType: "taxi" as const,
            origin: {
                address: originReference || "Ubicación GPS",
                lat: locationState.coords?.lat || 0,
                lng: locationState.coords?.lng || 0,
                address_references: originReference,
            },
            destination: {
                address: destinationText,
                lat: destinationCoords?.lat || 0,
                lng: destinationCoords?.lng || 0,
                address_references: selectedPlace ? `Destino popular: ${selectedPlace}` : destinationText,
            },
            notes: "",
            offerPrice: "33", // Base taxi fare
        };

        // Debug: log coordinates being submitted
        console.log('📍 Submitting request with coordinates:', {
            origin_lat: requestData.origin.lat,
            origin_lng: requestData.origin.lng,
            locationState: locationState.coords
        });

        // Submit directly with data
        const result = await submitRequest(requestData);

        if (result) {
            setCreatedRequestId(result.id);
        }
    };

    // Show searching animation if request was created
    if (createdRequestId) {
        // Show expired state
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
                        // Cancel the request in database
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
        <div className="space-y-5">
            <h1 className="text-xl font-bold">Solicitar Taxi</h1>

            {/* === ORIGIN SECTION === */}
            <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                    <Navigation className="w-5 h-5" />
                    <span>¿Dónde estás?</span>
                </div>

                {/* GPS Status */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-elevated">
                    {locationState.status === "loading" && (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-sm">Obteniendo ubicación...</span>
                        </>
                    )}
                    {locationState.status === "success" && (
                        <div className="flex items-center gap-3 w-full">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                {isGeocodingAddress ? (
                                    <span className="text-xs text-text-secondary">Obteniendo dirección...</span>
                                ) : geocodedAddress ? (
                                    <div>
                                        <p className="text-sm font-medium text-foreground truncate">
                                            📍 {geocodedAddress.street || geocodedAddress.neighborhood || "Tu ubicación"}
                                        </p>
                                        <p className="text-xs text-text-secondary truncate">
                                            {geocodedAddress.neighborhood && geocodedAddress.street !== geocodedAddress.neighborhood
                                                ? `${geocodedAddress.neighborhood}, `
                                                : ''
                                            }
                                            {geocodedAddress.city || geocodedAddress.state || ''}
                                        </p>
                                    </div>
                                ) : (
                                    <span className="text-xs text-green-600">✓ GPS capturado</span>
                                )}
                            </div>
                        </div>
                    )}
                    {locationState.status === "error" && (
                        <>
                            <MapPin className="w-5 h-5 text-red-500" />
                            <span className="text-sm text-red-500">{locationState.error}</span>
                            <Button size="sm" variant="outline" onClick={requestLocation}>
                                Reintentar
                            </Button>
                        </>
                    )}
                    {locationState.status === "idle" && (
                        <div className="flex flex-col items-center gap-2 w-full">
                            <Button className="w-full" onClick={requestLocation}>
                                <MapPin className="w-4 h-4 mr-2" />
                                Enviar mi ubicación actual
                            </Button>
                            <span className="text-xs text-text-muted text-center">
                                Toca para compartir tu ubicación GPS con el conductor
                            </span>
                        </div>
                    )}
                </div>

                {/* Reference field */}
                <div className="space-y-1">
                    <label className="text-sm text-text-muted">
                        Referencia para el conductor:
                    </label>
                    <Textarea
                        placeholder='Ej: "Frente al Oxxo", "Casa azul con portón negro"...'
                        value={originReference}
                        onChange={(e) => setOriginReference(e.target.value)}
                        rows={2}
                    />
                </div>
            </Card>

            {/* === DESTINATION SECTION === */}
            <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                    <MapPin className="w-5 h-5" />
                    <span>¿A dónde vas?</span>
                </div>

                {/* Destination text input */}
                <div className="relative">
                    <Textarea
                        placeholder='Escribe tu destino o selecciona uno popular...'
                        value={destinationText}
                        onChange={(e) => {
                            setDestinationText(e.target.value);
                            setSelectedPlace(null);
                        }}
                        rows={2}
                        className="pr-10 pb-10" // Space for button
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="absolute bottom-2 right-2 text-primary hover:bg-primary/10 h-8 text-xs"
                        onClick={() => setShowMapPicker(true)}
                    >
                        <MapIcon className="w-4 h-4 mr-1.5" />
                        Seleccionar en mapa
                    </Button>
                </div>

                {/* Popular places grid */}
                <div className="space-y-2">
                    <span className="text-xs text-text-muted uppercase tracking-wide">
                        Destinos populares
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        {POPULAR_PLACES.map((place) => {
                            const Icon = place.icon;
                            const isSelected = selectedPlace === place.id;
                            return (
                                <button
                                    key={place.id}
                                    onClick={() => handlePlaceSelect(place.id)}
                                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left text-sm ${isSelected
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border hover:border-primary/50 hover:bg-surface-elevated"
                                        }`}
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{place.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {/* Error display */}
            {error && (
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Base fare info */}
            <Card className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-green-800">Tarifa base local</p>
                        <p className="text-xs text-green-600">El conductor puede ofertar si hay mayor distancia</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-green-700">$33</p>
                        <p className="text-xs text-green-600">MXN</p>
                    </div>
                </div>
            </Card>

            {/* Submit button */}
            <Button
                className="w-full"
                size="lg"
                disabled={!isFormValid || isLoading}
                onClick={handleSubmit}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando solicitud...
                    </>
                ) : (
                    "Solicitar Taxi"
                )}
            </Button>
            {showMapPicker && (
                <LocationPickerMap
                    initialLocation={destinationCoords || locationState.coords}
                    onConfirm={(loc) => {
                        setDestinationText(loc.placeName);
                        setDestinationCoords(loc.coords);
                        setShowMapPicker(false);
                    }}
                    onCancel={() => setShowMapPicker(false)}
                />
            )}
        </div>
    );
}

