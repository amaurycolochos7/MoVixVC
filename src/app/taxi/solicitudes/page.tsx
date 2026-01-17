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

import { NegotiationModal } from "@/components/radar/negotiation-modal";
import { RequestCard } from "@/components/radar/request-card";

// ... existing imports

export default function TaxiSolicitudesPage() {
    const { profile } = useAuth();
    const supabase = createClient();

    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("service_requests")
                .select("*")
                .eq("service_type", "taxi")
                .in("status", ["pending", "negotiating"])
                .gt("request_expires_at", new Date().toISOString()) // Filter out expired
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRequests(data || []);
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

    const handleAccept = async (req: any, amount?: number) => {
        // Reuse the logic from radar or implement direct accept here
        // For consistency, we'll try to use a direct database update or redirect
        // Since we don't have the full radar context/functions here, we'll implement a simple accept
        try {
            if (!profile?.id) return;

            // Direct accept logic matching radar's simple accept
            const { error } = await supabase
                .from("service_requests")
                .update({
                    status: "assigned",
                    assigned_driver_id: profile.id,
                    final_price: amount || (req.service_type === 'taxi' ? 35 : (req.estimated_price || 22))
                })
                .eq("id", req.id)
                .eq("status", "pending"); // Prevent double accept

            if (error) throw error;

            toast.success("¡Viaje aceptado!");
            setSelectedRequest(null);
            fetchRequests(); // Refresh list
            // Optionally redirect to active service map
        } catch (err) {
            console.error(err);
            toast.error("No se pudo aceptar el viaje (quizás ya lo tomó otro)");
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
        <div className="min-h-screen p-4 pb-24" style={{ backgroundColor: '#f3f4f6' }}>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">Solicitudes Cercanas</h1>
                <Button variant="outline" size="sm" onClick={fetchRequests} className="bg-white">
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>

            {requests.length === 0 ? (
                <Card className="p-8 text-center border-none shadow-sm bg-white">
                    <Navigation className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium text-gray-900">No hay solicitudes cerca</p>
                    <p className="text-sm text-gray-500 mt-1">
                        Las nuevas solicitudes aparecerán aquí
                    </p>
                </Card>
            ) : (
                <div className="space-y-4">
                    {requests.map((request) => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            onCardClick={() => setSelectedRequest(request)}
                            onOffer={() => setSelectedRequest(request)}
                            onAccept={() => handleAccept(request)}
                            onShowMap={() => { }} // Map viewed inside modal mainly
                        />
                    ))}
                </div>
            )}

            {selectedRequest && (
                <NegotiationModal
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onAccept={(req, amount) => handleAccept(req, amount)}
                />
            )}
        </div>
    );
}

