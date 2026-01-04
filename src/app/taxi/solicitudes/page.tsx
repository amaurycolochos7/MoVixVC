"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Clock, MapPin, Navigation, Loader2, RefreshCw, DollarSign, Send, X, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ServiceRequest {
    id: string;
    client_id: string;
    service_type: string;
    status: string;
    origin_address: string;
    origin_neighborhood: string;
    origin_references: string;
    destination_address: string;
    destination_neighborhood: string;
    estimated_price: number;
    notes: string;
    created_at: string;
    request_expires_at: string;
}

export default function TaxiSolicitudesPage() {
    const { profile } = useAuth();
    const supabase = createClient();

    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [offerPrices, setOfferPrices] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("service_requests")
                .select("*")
                .eq("service_type", "taxi")
                .in("status", ["pending", "negotiating"])
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRequests(data || []);

            // Initialize offer prices with estimated prices
            const prices: Record<string, string> = {};
            data?.forEach(r => {
                prices[r.id] = r.estimated_price?.toString() || "50";
            });
            setOfferPrices(prev => ({ ...prev, ...prices }));
        } catch (err: any) {
            console.error("Error fetching requests:", err);
            toast.error("Error al cargar solicitudes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('taxi-requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'service_requests',
            }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleMakeOffer = async (requestId: string) => {
        if (!profile) return;

        const price = parseFloat(offerPrices[requestId]);
        if (isNaN(price) || price <= 0) {
            toast.error("Ingresa un precio válido");
            return;
        }

        setSubmitting(requestId);
        try {
            // Create offer
            const { error } = await supabase
                .from("offers")
                .insert({
                    request_id: requestId,
                    driver_id: profile.id,
                    offer_type: "initial",
                    offered_price: price,
                    status: "pending",
                    expires_at: new Date(Date.now() + 5 * 60000).toISOString(), // 5 min expiry
                });

            if (error) throw error;

            toast.success("¡Oferta enviada! Esperando respuesta del cliente");
            setExpandedId(null);
            fetchRequests();
        } catch (err: any) {
            console.error("Error making offer:", err);
            toast.error(err.message || "Error al enviar oferta");
        } finally {
            setSubmitting(null);
        }
    };

    const getTimeRemaining = (expiresAt: string) => {
        const diff = new Date(expiresAt).getTime() - Date.now();
        if (diff <= 0) return "Expirado";
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4" style={{ backgroundColor: '#f3f4f6' }}>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">Solicitudes Cercanas</h1>
                <Button variant="outline" size="sm" onClick={fetchRequests} className="bg-white">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {requests.length === 0 ? (
                <Card className="p-8 text-center">
                    <Navigation className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium text-text-secondary">No hay solicitudes cerca</p>
                    <p className="text-sm text-text-muted mt-1">
                        Las nuevas solicitudes aparecerán aquí
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests.map((request) => {
                        const isExpanded = expandedId === request.id;
                        const isSubmitting = submitting === request.id;

                        return (
                            <Card key={request.id} className="border-l-4 border-l-primary overflow-hidden">
                                {/* Header - Always visible */}
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base">
                                            {request.origin_neighborhood || "Origen"} → {request.destination_neighborhood || request.destination_address || "Destino"}
                                        </CardTitle>
                                        <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium capitalize">
                                            {request.service_type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-text-secondary mt-1">
                                        <span className="flex items-center">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {request.request_expires_at
                                                ? `Expira en ${getTimeRemaining(request.request_expires_at)}`
                                                : formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: es })
                                            }
                                        </span>
                                    </div>
                                </CardHeader>

                                <CardContent className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-text-secondary">Precio estimado:</p>
                                            <p className="font-bold text-xl text-green-600">
                                                ${request.estimated_price?.toFixed(2) || "50.00"}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setExpandedId(isExpanded ? null : request.id)}
                                        >
                                            {isExpanded ? (
                                                <>Cerrar <ChevronUp className="ml-1 h-4 w-4" /></>
                                            ) : (
                                                <>Ver Detalles <ChevronDown className="ml-1 h-4 w-4" /></>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-6 pb-4 space-y-4 border-t pt-4 bg-surface-elevated">
                                        {/* Locations */}
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-green-500 mt-1" />
                                                <div>
                                                    <p className="text-xs text-text-secondary">Origen</p>
                                                    <p className="text-sm font-medium">
                                                        {request.origin_address || "Ubicación GPS"}
                                                    </p>
                                                    {request.origin_references && (
                                                        <p className="text-xs text-text-muted">
                                                            Ref: {request.origin_references}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-red-500 mt-1" />
                                                <div>
                                                    <p className="text-xs text-text-secondary">Destino</p>
                                                    <p className="text-sm font-medium">
                                                        {request.destination_address || "No especificado"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {request.notes && (
                                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm">
                                                <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium mb-1">Notas del cliente:</p>
                                                <p className="text-yellow-700 dark:text-yellow-300">{request.notes}</p>
                                            </div>
                                        )}

                                        {/* Make Offer */}
                                        <div className="space-y-3">
                                            <p className="text-sm font-medium">Tu oferta:</p>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                                    <Input
                                                        type="number"
                                                        value={offerPrices[request.id] || ""}
                                                        onChange={(e) => setOfferPrices(prev => ({
                                                            ...prev,
                                                            [request.id]: e.target.value
                                                        }))}
                                                        className="pl-9"
                                                        placeholder="Precio"
                                                    />
                                                </div>
                                                <Button
                                                    onClick={() => handleMakeOffer(request.id)}
                                                    disabled={isSubmitting}
                                                    className="px-6"
                                                >
                                                    {isSubmitting ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <Send className="h-4 w-4 mr-2" />
                                                            Ofertar
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

