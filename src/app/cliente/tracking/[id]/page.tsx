"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { MapPin, Phone, MessageCircle, Share2, Star, Car, CheckCircle, Loader2, Navigation, Bike, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { TripRatingModal } from "@/components/rating";
import { ClientTrackingMap } from "@/components/maps/client-tracking-map";
import { RideBottomSheet } from "@/components/tracking/ride-bottom-sheet";
import { RideTopBar } from "@/components/tracking/ride-top-bar";
import { OfferModal } from "@/components/tracking/offer-modal";
import { CancellationModal } from "@/components/tracking/cancellation-modal";
import { CancelledNotificationModal } from "@/components/tracking/cancelled-notification-modal";
import { useServiceDriverLocation } from "@/hooks/useServiceDriverLocation";
import { MandaditoClientTracking } from "@/components/tracking/mandadito-client-tracking";

// Make sure to remove any other imports if they are unused
// import { TripAnimation } from "@/components/tracking"; 

interface ServiceRequest {
    id: string;
    status: string;
    tracking_step: string;
    service_type: string;
    origin_address: string;
    origin_lat: number;
    origin_lng: number;
    destination_address: string;
    destination_lat: number;
    destination_lng: number;
    created_at: string;
    updated_at: string;
    estimated_price: number;
    final_price: number;
    assigned_driver_id: string | null;
    notes: string;
    cancellation_reason: string | null;
    boarding_pin: string | null;
    request_expires_at?: string;
}

interface Driver {
    id: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
    rating_avg: number;
    rating_count: number;
    car_model?: string;
    car_plate?: string;
}

export default function ClienteTrackingPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const supabase = createClient();
    const requestId = params.id as string;

    const [request, setRequest] = useState<ServiceRequest | null>(null);
    const [driver, setDriver] = useState<Driver | null>(null);
    const [loading, setLoading] = useState(true);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [hasRated, setHasRated] = useState(false);

    // Live driver location for distance checks (Moved up to fix Hook Error)
    const { lastLocation } = useServiceDriverLocation({ serviceId: requestId });

    // Cancellation Logic States
    // Cancellation Logic States
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Timer Logic
    const [timeLeft, setTimeLeft] = useState(0);
    const [activeOffer, setActiveOffer] = useState<any>(null);

    useEffect(() => {
        if (!request || request.status !== 'pending') return;

        const updateTimer = () => {
            const expiresAt = request.request_expires_at
                ? new Date(request.request_expires_at).getTime()
                : new Date(request.created_at).getTime() + (request.service_type === 'mandadito' ? 110000 : 25000);

            const now = Date.now();
            const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
            setTimeLeft(left);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [request]);

    const totalDuration = request?.service_type === 'mandadito' ? 110 : 25;
    const percentage = Math.min(100, Math.max(0, (timeLeft / totalDuration) * 100));
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Helper to calculate distance (Haversine)
    const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // in meters
    };

    // Mock ETA and Distance since calculating it from hook requires passing it up or using context
    // For now, we'll try to get it from the map component if possible, or just default it
    // In a real refactor, the map component should expose these metrics via a callback
    const [routeMetrics, setRouteMetrics] = useState({ eta: 5, distance: 1.2 });

    // Track previous status for change detection
    // Track previous status for change detection
    const prevStatusRef = useRef<string | undefined>(undefined);
    const prevTrackingStepRef = useRef<string | undefined>(undefined);
    const [isStatusChanging, setIsStatusChanging] = useState(false);

    // Show animated toast when status changes
    const showStatusChangeToast = (newStatus: string, newStep?: string) => {
        const status = newStep || newStatus;

        switch (status) {
            case "assigned":
                toast.success("Conductor asignado", {
                    description: "Tu conductor va en camino",
                    icon: <Car className="w-5 h-5" />,
                    duration: 4000,
                });
                break;
            case "on_the_way":
                toast.info("Conductor en camino", {
                    description: "Llegará pronto",
                    icon: <Navigation className="w-5 h-5 animate-pulse" />,
                    duration: 4000,
                });
                break;
            case "nearby":
                toast.warning("Conductor muy cerca", {
                    description: "Está a punto de llegar",
                    icon: <MapPin className="w-5 h-5 animate-bounce" />,
                    duration: 5000,
                });
                break;
            case "arrived":
                toast.success("¡El conductor ha llegado!", {
                    description: "Ya está en el punto de recogida",
                    icon: <CheckCircle className="w-5 h-5" />,
                    duration: 5000,
                });
                break;
            case "picked_up":
                toast.info("Viaje iniciado", {
                    description: "Disfruta tu viaje",
                    icon: <Car className="w-5 h-5" />,
                    duration: 4000,
                });
                break;
            case "in_transit":
                toast.info("Llegando a tu destino", {
                    description: "Estás cerca de tu destino",
                    icon: <MapPin className="w-5 h-5" />,
                    duration: 4000,
                });
                break;
        }
    };

    const fetchRequest = async () => {
        try {
            const { data, error } = await supabase
                .from("service_requests")
                .select("*")
                .eq("id", requestId)
                .single();

            if (error) throw error;
            setRequest(data);

            // If completed, check if already rated and show rating modal
            if (data.status === "completed" && !hasRated) {
                const { data: existingRating } = await supabase
                    .from("driver_ratings")
                    .select("id")
                    .eq("request_id", requestId)
                    .maybeSingle();

                if (existingRating) {
                    setHasRated(true);
                } else {
                    setShowRatingModal(true);
                }
            }

            // Fetch driver if assigned
            if (data.assigned_driver_id) {
                const { data: driverData } = await supabase
                    .from("users")
                    .select("id, full_name, phone, avatar_url, rating_avg, rating_count")
                    .eq("id", data.assigned_driver_id)
                    .single();

                // Mock car info since it's not in basic user table in this schema yet
                const fullDriverData: Driver = {
                    ...(driverData as any),
                    car_model: "Nissan Versa",
                    car_plate: "ABC-123"
                }

                if (driverData) setDriver(fullDriverData);
            }
        } catch (err: any) {
            console.error("Error fetching request:", err);
            // Don't show toast on every poll fail
        } finally {
            setLoading(false);
        }
    };

    // Fetch and subscribe to offers + request updates
    useEffect(() => {
        fetchRequest();

        // ✨ FETCH INITIAL OFFERS - Check for existing pending offers
        const fetchOffers = async () => {
            console.log("🔍 Fetching existing offers for request:", requestId);
            try {
                const { data, error } = await supabase
                    .from("offers")
                    .select("*")
                    .eq("request_id", requestId)
                    .eq("status", "pending")
                    .order("created_at", { ascending: false });

                if (error) {
                    console.error("❌ Error fetching offers:", error);
                    return;
                }

                console.log("📊 Found offers:", data?.length || 0, data);

                if (data && data.length > 0) {
                    // Show the most recent offer
                    setActiveOffer(data[0]);
                    toast.info("¡Tienes ofertas pendientes!");
                }
            } catch (err) {
                console.error("❌ Exception fetching offers:", err);
            }
        };

        fetchOffers(); // Load existing offers on mount

        // Subscribe to realtime updates
        const channel = supabase
            .channel(`client-tracking-${requestId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'service_requests',
                filter: `id=eq.${requestId}`
            }, (payload) => {
                console.log("🔄 Request update:", payload);
                fetchRequest();
            })
            // Listen for OFFERS (Global listen to debug filter issues)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'offers'
            }, (payload) => {
                console.log("📨 RAW Offer event received:", payload);

                // Client-side filtering
                const newData = payload.new as any;
                console.log("🔍 Offer request_id:", newData?.request_id, "Current requestId:", requestId);

                if (newData.request_id !== requestId) {
                    console.log("⏭️ Skipping offer - not for this request");
                    return;
                }

                console.log("✅ Offer is for this request! Event:", payload.eventType, "Status:", newData.status);

                if (payload.eventType === 'INSERT' && newData.status === 'pending') {
                    console.log("🎉 NEW OFFER! Setting active offer:", newData);
                    setActiveOffer(newData);
                    toast.info("¡Has recibido una oferta!");
                } else if (payload.eventType === 'UPDATE') {
                    console.log("🔄 UPDATED OFFER - Status:", newData.status);
                    if (newData.status === 'pending') {
                        setActiveOffer(newData);
                    } else {
                        setActiveOffer(null);
                    }
                }
            })
            .subscribe((status) => {
                console.log("📡 Realtime subscription status:", status);
            });

        // Polling backup
        const pollInterval = setInterval(() => {
            fetchRequest();
            fetchOffers(); // Also poll for offers
        }, 4000);

        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [requestId]);

    // Detect status changes and show toasts
    useEffect(() => {
        if (request && prevStatusRef.current && prevStatusRef.current !== request.status) {
            showStatusChangeToast(request.status, request.tracking_step);
            setIsStatusChanging(true);
            setTimeout(() => setIsStatusChanging(false), 1000);
        }
        if (request && prevTrackingStepRef.current && prevTrackingStepRef.current !== request.tracking_step) {
            showStatusChangeToast(request.status, request.tracking_step);
            setIsStatusChanging(true);
            setTimeout(() => setIsStatusChanging(false), 1000);
        }
        prevStatusRef.current = request?.status;
        prevTrackingStepRef.current = request?.tracking_step;
    }, [request?.status, request?.tracking_step]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!request) return null;

    // Determine if we show map
    const showMap = request && ["assigned", "in_progress", "picking_up", "arrived"].includes(request.status);

    const getCancellationRestrictions = () => {
        if (!request || request.status === "pending") return { canCancel: true };

        // 1. Time restriction (5 minutes)
        if (request.status === "assigned" || request.status === "on_the_way" || request.status === "nearby") {
            // Use assigned_at or created_at if assigned_at is null/missing
            // Assuming we track assigned_at in the DB, though the interface above showed it might be null
            // We'll use created_at as fallback but ideally assigned_at is better
            const startTime = new Date(request.created_at).getTime();
            const now = Date.now();
            const minutesElapsed = (now - startTime) / 1000 / 60;

            if (minutesElapsed > 5) {
                return {
                    canCancel: false,
                    reason: "time" as const,
                    message: "Han pasado más de 5 minutos desde la solicitud. Para cancelar, contacta a soporte." // Simplified per user request
                };
            }

            // 2. Distance restriction (e.g. < 300 meters)
            if (lastLocation && request.origin_lat && request.origin_lng) {
                const distMeters = calculateDistance(
                    lastLocation.lat, lastLocation.lng,
                    request.origin_lat, request.origin_lng
                );

                if (distMeters < 300) { // 300 meters threshold
                    return {
                        canCancel: false,
                        reason: "distance" as const,
                        message: "El conductor está muy cerca de tu ubicación (a menos de 300m). Ya no es posible cancelar."
                    };
                }
            }
        }

        return { canCancel: true };
    };

    const handleCancelClick = () => {
        setShowCancelModal(true);
    };

    const handleConfirmCancel = async (reason: string) => {
        try {
            await supabase
                .from("service_requests")
                .update({
                    status: "cancelled",
                    cancellation_reason: reason
                })
                .eq("id", requestId);

            setShowCancelModal(false);
            toast.success("Viaje cancelado");
            router.push("/cliente");
        } catch (e) {
            toast.error("Error al cancelar");
        }
    };

    const handleAcceptOffer = async (offer: any) => {
        console.log("🎯 Accepting offer:", offer);
        try {
            // Update offer status
            const { error: offerError } = await supabase
                .from('offers')
                .update({ status: 'accepted' })
                .eq('id', offer.id);

            if (offerError) {
                console.error("❌ Error updating offer:", offerError);
                throw offerError;
            }

            // Assign driver and update request with CORRECT status
            const { error: requestError } = await supabase
                .from('service_requests')
                .update({
                    status: 'assigned', // CORRECTED: was 'driver_assigned'
                    assigned_driver_id: offer.driver_id,
                    final_price: offer.offered_price // Added final_price
                })
                .eq('id', requestId);

            if (requestError) {
                console.error("❌ Error updating request:", requestError);
                throw requestError;
            }

            console.log("✅ Offer accepted successfully!");
            setActiveOffer(null);
            toast.success("¡Oferta aceptada! Tu conductor va en camino.");
            fetchRequest(); // Reload request to show driver info
        } catch (e) {
            console.error("❌ Error accepting offer:", e);
            toast.error("Error al aceptar oferta");
        }
    };

    const handleRejectOffer = async (offer: any) => {
        try {
            await supabase.from('offers').update({ status: 'rejected' }).eq('id', offer.id);
            setActiveOffer(null);
            toast.info("Oferta rechazada");
        } catch (e) {
            toast.error("Error al rechazar");
        }
    };

    const handleCounterOffer = async (offer: any, amount: number) => {
        try {
            await supabase.from('offers').update({
                offered_price: amount,
                status: 'pending',
                offer_type: 'client_counter'
            }).eq('id', offer.id);

            setActiveOffer(null); // Hide modal while waiting for driver
            toast.success("Contraoferta enviada al conductor");
        } catch (e) {
            toast.error("Error al enviar contraoferta");
        }
    };

    const handleRetry = async () => {
        try {
            const now = new Date();
            const newExpires = new Date(now.getTime() + 110 * 1000).toISOString(); // 110s renewal

            await supabase.from("service_requests").update({
                status: 'pending',
                created_at: now.toISOString(),
                request_expires_at: newExpires,
                assigned_driver_id: null
            }).eq('id', requestId);

            toast.success("Solicitud reactivada");
            // Force reload to reset timer state
            window.location.reload();
        } catch (e) {
            toast.error("Error al reintentar");
        }
    };



    // If completed or cancelled, show different view or redirect
    if (request.status === "completed" || request.status === "cancelled") {
        if (request.status === "cancelled") {
            // For mandadito, show notification modal with reason
            if (request.service_type === 'mandadito') {
                return (
                    <div className="h-screen w-full bg-gray-100 flex items-center justify-center">
                        <CancelledNotificationModal
                            open={true}
                            cancelledBy="driver"
                            reason={request.cancellation_reason || "El servicio ha sido cancelado"}
                            onClose={() => router.push("/cliente")}
                        />
                    </div>
                );
            }
            // For taxi, keep original behavior
            router.push("/cliente");
            return null;
        }
    }

    const restrictions = getCancellationRestrictions();

    // Render Mandadito-specific tracking ONLY when driver is assigned (not pending/negotiating)
    // During pending and negotiating, we use the main UI which has the OfferModal
    if (request.service_type === 'mandadito' && request.status !== 'pending' && request.status !== 'negotiating') {
        return (
            <MandaditoClientTracking
                requestId={requestId}
                request={request}
                driver={driver}
            />
        );
    }

    // Render Taxi tracking (original UI)
    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-100 flex flex-col">
            {/* Top Bar */}
            {driver && (
                <RideTopBar
                    driverName={driver.full_name}
                    driverRating={driver.rating_avg}
                    carModel={driver.car_model}
                    plate={driver.car_plate}
                    onCall={() => window.open(`tel:${driver.phone}`)}
                />
            )}

            {/* Full Screen Map or Waiting */}
            <div className="flex-1 w-full relative z-0">
                {showMap ? (
                    <ClientTrackingMap
                        serviceId={requestId}
                        pickupLocation={{ lat: request.origin_lat, lng: request.origin_lng }}
                        dropoffLocation={request.destination_lat ? { lat: request.destination_lat, lng: request.destination_lng } : undefined}
                        trackingStep={request.tracking_step}
                        serviceType={request.service_type} // Pass type (mandadito/taxi)
                        className="w-full h-full"
                    // Future: Pass onMetricsChange={(m) => setRouteMetrics(m)}
                    />
                ) : (
                    /* Waiting Screen while pending - DiDi Style */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-6">
                        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full">
                            {/* Header with Icon */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative w-20 h-20 mb-4">
                                    {/* Animated ring */}
                                    <div className="absolute inset-0 rounded-full border-4 border-orange-100" />
                                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                        <circle
                                            cx="40" cy="40" r="36"
                                            fill="transparent"
                                            stroke="#f97316"
                                            strokeWidth="4"
                                            strokeDasharray={226}
                                            strokeDashoffset={226 - (percentage / 100) * 226}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000"
                                        />
                                    </svg>
                                    {/* Center icon */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
                                            {request.service_type === 'mandadito' ? (
                                                <Bike className="w-6 h-6 text-white" />
                                            ) : (
                                                <Car className="w-6 h-6 text-white" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Timer */}
                                <div className={`text-2xl font-bold ${percentage > 20 ? 'text-gray-900' : 'text-red-500'}`}>
                                    {timeLeft}s
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
                                {request.service_type === 'mandadito' ? 'Buscando repartidor' : 'Buscando conductor'}
                            </h2>
                            <p className="text-gray-500 text-sm text-center mb-6">
                                {request.service_type === 'mandadito'
                                    ? 'Estamos conectando con un mensajero cercano'
                                    : 'Estamos buscando el conductor más cercano'}
                            </p>

                            {/* Order summary for mandadito */}
                            {request.service_type === 'mandadito' && (
                                <div className="bg-white rounded-xl p-5 text-left border border-gray-200 shadow-sm mb-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                            <Package className="h-5 w-5 text-orange-500" />
                                        </div>
                                        <span className="font-semibold text-gray-900 text-lg">Tu pedido</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4">{request.notes || 'Mandadito'}</p>
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                        <span className="text-sm text-gray-500">Precio estimado</span>
                                        <span className="text-lg font-bold text-orange-500">${request.estimated_price} MXN</span>
                                    </div>
                                </div>
                            )}

                            {/* Actions: Retry or Cancel */}
                            {timeLeft <= 0 ? (
                                <div className="w-full space-y-4 mt-6">
                                    <button
                                        onClick={handleRetry}
                                        className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30"
                                    >
                                        Solicitar Nuevamente
                                    </button>
                                    <button
                                        onClick={() => {
                                            supabase.from('service_requests')
                                                .update({ status: 'cancelled', cancellation_reason: 'Cliente canceló tras expirar' })
                                                .eq('id', requestId)
                                                .then(() => router.push('/cliente'));
                                        }}
                                        className="w-full text-gray-400 text-sm hover:text-gray-600 py-2"
                                    >
                                        Cancelar y salir
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        supabase.from('service_requests')
                                            .update({ status: 'cancelled', cancellation_reason: 'Cliente canceló mientras esperaba' })
                                            .eq('id', requestId)
                                            .then(() => {
                                                toast.info('Solicitud cancelada');
                                                router.push('/cliente');
                                            });
                                    }}
                                    className="w-full text-red-500 text-sm font-medium hover:text-red-600 mt-6 py-2"
                                >
                                    Cancelar solicitud
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Sheet */}
            {driver && (
                <RideBottomSheet
                    eta={routeMetrics.eta}
                    distance={routeMetrics.distance}
                    status={request.tracking_step || request.status}
                    destination={request.destination_address || "Destino seleccionado"}
                    pickup={request.origin_address}
                    driverName={driver.full_name}
                    driverPlate={driver.car_plate}
                    driverCar={driver.car_model}
                    price={request.estimated_price}
                    boardingPin={request.boarding_pin || undefined}
                    onCancel={handleCancelClick}
                    onCall={() => window.open(`tel:${driver.phone}`)}
                    onMessage={() => console.log("Open chat")} // Placeholder
                    onShare={() => console.log("Share trip")} // Placeholder
                />
            )}

            {/* Offer Modal */}
            {activeOffer && (
                <OfferModal
                    offer={activeOffer}
                    onClose={() => {/* Can't close without action? Or allow minimize? Strict mode: No close */ }}
                    onAccept={handleAcceptOffer}
                    onReject={handleRejectOffer}
                    onCounter={handleCounterOffer}
                />
            )}


            {/* Cancellation Modal */}
            <CancellationModal
                open={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={handleConfirmCancel}
                canCancel={restrictions.canCancel}
                restrictionReason={restrictions.reason}
                restrictionMessage={restrictions.message}
            />

            {/* Rating Modal */}
            {showRatingModal && driver && (
                <TripRatingModal
                    requestId={request.id}
                    driverId={driver.id}
                    driverName={driver.full_name}
                    onClose={() => {
                        setShowRatingModal(false);
                        router.push("/cliente");
                    }}
                    onRated={() => {
                        setHasRated(true);
                        router.push("/cliente");
                    }}
                />
            )}
        </div>
    );
}
