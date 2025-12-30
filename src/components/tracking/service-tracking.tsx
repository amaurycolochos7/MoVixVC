"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleMapWrapper } from "@/components/maps/google-map-wrapper";
import { MapCanvas } from "@/components/maps/map-canvas";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Marker } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, CheckCircle, Navigation } from "lucide-react";
import { toast } from "sonner";
import { parseSupabaseError } from "@/lib/error-utils";

interface ServiceTrackingProps {
    requestId: string;
    userRole: "client" | "driver";
    initialRequestData?: any;
}

function TrackingCardSkeleton() {
    return (
        <Card className="absolute bottom-0 left-0 right-0 p-4 rounded-t-xl shadow-xl space-y-4">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <Skeleton className="h-12 w-full" />
        </Card>
    );
}

export function ServiceTracking({ requestId, userRole, initialRequestData }: ServiceTrackingProps) {
    const supabase = createClient();
    const [request, setRequest] = useState<any>(initialRequestData);
    const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
    const { coordinates: myLoc } = useGeolocation();

    // Fetch latest request data if not provided
    useEffect(() => {
        if (!initialRequestData) {
            supabase.from("service_requests").select("*").eq("id", requestId).single().then(({ data }) => {
                if (data) setRequest(data);
            });
        }
    }, [requestId, initialRequestData, supabase]);

    // Role Specific Logic: CLIENT (Listen to Driver)
    useEffect(() => {
        if (!request || userRole !== "client" || !request.assigned_driver_id) return;

        const channel = supabase
            .channel(`driver-loc:${request.assigned_driver_id}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "users",
                    filter: `id=eq.${request.assigned_driver_id}`,
                },
                (payload) => {
                    const newUser = payload.new;
                    if (newUser.current_lat && newUser.current_lng) {
                        setDriverLoc({ lat: newUser.current_lat, lng: newUser.current_lng });
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userRole, request, supabase]);

    // Role Specific Logic: DRIVER (Broadcast Location)
    useEffect(() => {
        if (!request || userRole !== "driver" || !myLoc) return;

        // ONLY broadcast if status is tracked
        if (!['assigned', 'in_progress'].includes(request.status)) return;

        const interval = setInterval(async () => {
            await supabase.from("users").update({
                current_lat: myLoc.lat,
                current_lng: myLoc.lng,
                location_updated_at: new Date().toISOString()
            }).eq("id", (await supabase.auth.getUser()).data.user?.id);
        }, 10000); // 10s throttle

        return () => clearInterval(interval);
    }, [userRole, request?.status, myLoc, supabase]);

    // Service Status Logic
    const updateStatus = async (newStatus: string) => {
        try {
            const { error } = await supabase
                .from("service_requests")
                .update({
                    status: newStatus,
                    ...(newStatus === 'in_progress' ? { started_at: new Date().toISOString() } : {}),
                    ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {})
                })
                .eq("id", requestId);

            if (error) throw error;

            setRequest({ ...request, status: newStatus });

            if (newStatus === 'assigned') {
                toast.success("Servicio asignado");
            } else if (newStatus === 'in_progress') {
                toast.success("Viaje iniciado");
            } else if (newStatus === 'completed') {
                toast.success("Viaje completado");
            }
        } catch (err) {
            const { message } = parseSupabaseError(err);
            toast.error(message);
        }
    };

    if (!request) {
        return (
            <GoogleMapWrapper>
                <div className="h-full flex flex-col relative bg-surface">
                    <div className="flex-1 relative bg-gray-200 animate-pulse" />
                    <TrackingCardSkeleton />
                </div>
            </GoogleMapWrapper>
        );
    }

    const mapCenter = userRole === 'driver' ? myLoc : (driverLoc || { lat: request.origin_lat, lng: request.origin_lng });

    return (
        <GoogleMapWrapper>
            <div className="h-full flex flex-col relative bg-surface">
                {/* Map */}
                <div className="flex-1 relative">
                    <MapCanvas
                        defaultCenter={mapCenter || undefined}
                        defaultZoom={15}
                    >
                        {/* Origin Marker */}
                        <Marker position={{ lat: request.origin_lat, lng: request.origin_lng }} label="A" />

                        {/* Destination Marker */}
                        <Marker position={{ lat: request.destination_lat, lng: request.destination_lng }} label="B" />

                        {/* Driver Marker */}
                        {(driverLoc || (userRole === 'driver' && myLoc)) && (
                            <Marker
                                position={userRole === 'driver' ? myLoc! : driverLoc!}
                                title="Conductor"
                            // icon (Taxicab icon)
                            />
                        )}

                        {/* TODO: Route Renderer Here */}
                    </MapCanvas>
                </div>

                {/* Tracking Controls */}
                <Card className="absolute bottom-0 left-0 right-0 p-4 rounded-t-xl shadow-xl space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-sm text-text-muted">Estado del viaje</p>
                            <p className="text-xl font-bold uppercase text-primary">
                                {request.status === 'assigned' ? 'En Camino' :
                                    request.status === 'in_progress' ? 'En Curso' : 'Finalizado'}
                            </p>
                        </div>
                        {userRole === 'client' && (
                            <Button size="icon" variant="secondary" className="rounded-full">
                                <Phone className="h-5 w-5" />
                            </Button>
                        )}
                    </div>

                    {userRole === 'driver' && (
                        <div className="space-y-2">
                            {request.status === 'assigned' && (
                                <Button className="w-full h-12 text-lg" onClick={() => updateStatus('in_progress')}>
                                    <Navigation className="mr-2 h-5 w-5" /> Iniciar Viaje
                                </Button>
                            )}
                            {request.status === 'in_progress' && (
                                <Button className="w-full h-12 text-lg bg-green-600 hover:bg-green-700" onClick={() => updateStatus('completed')}>
                                    <CheckCircle className="mr-2 h-5 w-5" /> Finalizar Viaje
                                </Button>
                            )}
                            {request.status === 'completed' && (
                                <div className="p-4 bg-green-100 text-green-700 text-center rounded">
                                    Viaje completado
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </GoogleMapWrapper>
    );
}
