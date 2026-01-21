"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, CheckCircle, MapPin, Navigation, User, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ServiceTrackingProps {
    requestId: string;
    userRole: "client" | "driver";
    initialRequestData?: any;
}

// Helper to get correct service path based on service type
function getServicePath(serviceType: string, requestId: string): string {
    if (serviceType === "moto_ride") {
        return `/moto-ride/servicio/${requestId}`;
    } else if (serviceType === "mandadito") {
        return `/mandadito/servicio/${requestId}`;
    } else {
        return `/taxi/servicio/${requestId}`;
    }
}

export function ServiceTracking({ requestId, userRole, initialRequestData }: ServiceTrackingProps) {
    const supabase = createClient();
    const router = useRouter();
    const [request, setRequest] = useState<any>(initialRequestData);
    const [loading, setLoading] = useState(!initialRequestData);

    // Fetch latest request data
    useEffect(() => {
        const fetchRequest = async () => {
            const { data } = await supabase
                .from("service_requests")
                .select("*")
                .eq("id", requestId)
                .single();
            if (data) setRequest(data);
            setLoading(false);
        };

        if (!initialRequestData) {
            fetchRequest();
        }
    }, [requestId, initialRequestData]);

    // Auto-redirect to service page for drivers
    useEffect(() => {
        if (request && userRole === "driver" && request.status !== "completed") {
            const servicePath = getServicePath(request.service_type, requestId);
            router.push(servicePath);
        }
    }, [request, userRole, requestId, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!request) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <p className="text-text-secondary">Servicio no encontrado</p>
            </div>
        );
    }

    // Simple card view without map
    return (
        <div className="p-4 space-y-4">
            <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-text-muted">Estado del viaje</p>
                        <p className="text-xl font-bold uppercase text-primary">
                            {request.status === 'assigned' ? 'En Camino' :
                                request.status === 'in_progress' ? 'En Curso' : 'Finalizado'}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Navigation className="h-6 w-6 text-primary" />
                    </div>
                </div>
            </Card>

            {/* Route Info */}
            <Card className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                        <p className="text-xs text-text-secondary">Origen</p>
                        <p className="font-medium">{request.origin_address || "Ubicación GPS"}</p>
                    </div>
                </div>
                {request.destination_address && (
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                            <p className="text-xs text-text-secondary">Destino</p>
                            <p className="font-medium">{request.destination_address}</p>
                        </div>
                    </div>
                )}
            </Card>

            {userRole === "driver" && (
                <Button
                    className="w-full h-12"
                    onClick={() => router.push(getServicePath(request.service_type, requestId))}
                >
                    <ArrowRight className="h-5 w-5 mr-2" />
                    Ir a pantalla de servicio
                </Button>
            )}
        </div>
    );
}

