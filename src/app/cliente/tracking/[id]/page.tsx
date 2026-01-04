"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { TripRatingModal } from "@/components/rating";
import { ClientTrackingMap } from "@/components/maps/client-tracking-map";
import { RideBottomSheet } from "@/components/tracking/ride-bottom-sheet";
import { RideTopBar } from "@/components/tracking/ride-top-bar";

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

    // Mock ETA and Distance since calculating it from hook requires passing it up or using context
    // For now, we'll try to get it from the map component if possible, or just default it
    // In a real refactor, the map component should expose these metrics via a callback
    const [routeMetrics, setRouteMetrics] = useState({ eta: 5, distance: 1.2 });

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!request) return null;

    const handleCancel = async () => {
        if (!confirm("¿Seguro que quieres cancelar el viaje?")) return;

        try {
            await supabase
                .from("service_requests")
                .update({ status: "cancelled", cancellation_reason: "Cancelado por usuario" })
                .eq("id", requestId);
            toast.success("Viaje cancelado");
            router.push("/cliente");
        } catch (e) {
            toast.error("Error al cancelar");
        }
    };

    // Determine if we show map
    const showMap = ["assigned", "in_progress", "picking_up", "arrived"].includes(request.status);

    // If completed or cancelled, show different view or redirect
    if (request.status === "completed" || request.status === "cancelled") {
        // Just a simple overlay or redirect for now to keep it clean
        // Ideally reuse the rating modal logic
        if (request.status === "cancelled") {
            router.push("/cliente");
            return null;
        }
    }

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
                    onCancel={handleCancel}
                    onCall={() => window.open(`tel:${driver.phone}`)}
                    onMessage={() => console.log("Open chat")} // Placeholder
                    onShare={() => console.log("Share trip")} // Placeholder
                />
            )}

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
