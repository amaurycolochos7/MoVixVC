"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Car, MapPin, CheckCircle, Navigation } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { TripRatingModal } from "@/components/rating";
import { ClientTrackingMap } from "@/components/maps/client-tracking-map";
import { RideBottomSheet } from "@/components/tracking/ride-bottom-sheet";
import { RideTopBar } from "@/components/tracking/ride-top-bar";
import { CancellationModal } from "@/components/tracking/cancellation-modal";
import { useServiceDriverLocation } from "@/hooks/useServiceDriverLocation";

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
    const [showCancelModal, setShowCancelModal] = useState(false);

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
    const prevStatusRef = useRef<string | undefined>();
    const prevTrackingStepRef = useRef<string | undefined>();
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

    useEffect(() => {
        fetchRequest();

        // Subscribe to realtime updates
        const channel = supabase
            .channel(`client-tracking-${requestId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'service_requests',
                filter: `id=eq.${requestId}`
            }, (payload) => {
                fetchRequest();
            })
            .subscribe();

        // Polling backup
        const pollInterval = setInterval(fetchRequest, 4000);

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



    // If completed or cancelled, show different view or redirect
    if (request.status === "completed" || request.status === "cancelled") {
        if (request.status === "cancelled") {
            router.push("/cliente");
            return null;
        }
    }

    const restrictions = getCancellationRestrictions();

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

            {/* Full Screen Map */}
            <div className="flex-1 w-full relative z-0">
                {showMap ? (
                    <ClientTrackingMap
                        serviceId={requestId}
                        pickupLocation={{ lat: request.origin_lat, lng: request.origin_lng }}
                        dropoffLocation={request.destination_lat ? { lat: request.destination_lat, lng: request.destination_lng } : undefined}
                        serviceStatus={request.status}
                        className="w-full h-full"
                    // Future: Pass onMetricsChange={(m) => setRouteMetrics(m)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500 mb-2" />
                            <p className="text-gray-500">Buscando conductor...</p>
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
                    onCancel={handleCancelClick}
                    onCall={() => window.open(`tel:${driver.phone}`)}
                    onMessage={() => console.log("Open chat")} // Placeholder
                    onShare={() => console.log("Share trip")} // Placeholder
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
