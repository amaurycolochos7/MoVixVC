"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Package, Car, MapPin, Clock, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ServiceRequest {
    id: string;
    status: string;
    service_type: string;
    origin_address: string;
    destination_address: string;
    created_at: string;
    estimated_price: number;
}

export default function ClienteActivosPage() {
    const router = useRouter();
    const { user } = useAuth();
    const supabase = createClient();

    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchActiveRequests = async () => {
        if (!user) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from("service_requests")
                .select("*")
                .eq("client_id", user.id)
                .in("status", ["assigned", "in_progress"])
                .order("created_at", { ascending: false });

            if (fetchError) throw fetchError;
            setRequests(data || []);
        } catch (err: any) {
            console.error("Error fetching requests:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveRequests();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('client-requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'service_requests',
                filter: `client_id=eq.${user?.id}`
            }, () => {
                fetchActiveRequests();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { color: string; text: string }> = {
            assigned: { color: "bg-blue-100 text-blue-800", text: "Conductor asignado" },
            in_progress: { color: "bg-green-100 text-green-800", text: "En curso" },
        };
        return badges[status] || { color: "bg-gray-100 text-gray-800", text: status };
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">Servicios Activos</h1>
                <Button variant="ghost" size="sm" onClick={fetchActiveRequests}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {error && (
                <Card className="p-4 bg-red-50 border-red-200">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                </Card>
            )}

            {requests.length === 0 ? (
                <Card className="p-8 text-center text-text-muted border-dashed">
                    <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium">Sin servicios activos</p>
                    <p className="text-sm mt-1">Tus servicios en curso aparecerán aquí.</p>
                    <Button variant="link" className="mt-2" onClick={() => router.push("/cliente/historial")}>
                        Ver historial
                    </Button>
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests.map((request) => {
                        const badge = getStatusBadge(request.status);
                        return (
                            <Card
                                key={request.id}
                                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => router.push(`/cliente/tracking/${request.id}`)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Car className="h-5 w-5 text-primary" />
                                        <span className="font-medium capitalize">{request.service_type}</span>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${badge.color}`}>
                                        {badge.text}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-green-500 mt-0.5" />
                                        <span className="text-text-secondary">
                                            {request.origin_address || "Ubicación GPS"}
                                        </span>
                                    </div>
                                    {request.destination_address && (
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                                            <span className="text-text-secondary">
                                                {request.destination_address}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                            {formatDistanceToNow(new Date(request.created_at), {
                                                addSuffix: true,
                                                locale: es
                                            })}
                                        </span>
                                    </div>
                                    {request.estimated_price > 0 && (
                                        <span className="font-bold text-green-600">
                                            ${request.estimated_price}
                                        </span>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

