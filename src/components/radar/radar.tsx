"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { RequestCard } from "./request-card";
import { RequestCardSkeletonList } from "./request-card-skeleton";
import { RefreshCw, Inbox } from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseSupabaseError } from "@/lib/error-utils";

interface RadarProps {
    serviceType: "taxi" | "mandadito";
    isAvailable: boolean;
}


export function Radar({ serviceType, isAvailable }: RadarProps) {
    const supabase = createClient();
    // const [isAvailable, setIsAvailable] = useState(false); // Removed, controlled by parent
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [offerPrice, setOfferPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newRequestCount, setNewRequestCount] = useState(0);

    /* Removed initial status check - parent handles auth/status checks implicitly or explicitly */

    // Initial Fetch (Manual refresh or on load)
    const fetchRequests = async () => {
        setLoading(true);
        setNewRequestCount(0); // Reset counter on refresh
        try {
            let query = supabase
                .from("service_requests")
                .select("*")
                .eq("status", "pending")
                .eq("municipio", "Venustiano Carranza") // Local Filter MVP
                .gt("request_expires_at", new Date().toISOString()) // Filter expired
                .order("created_at", { ascending: false });

            if (serviceType) {
                query = query.eq("service_type", serviceType);
            }

            const { data, error } = await query;

            if (error) throw error;
            if (data) setRequests(data);
        } catch (err) {
            const { message } = parseSupabaseError(err);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAvailable) fetchRequests();
    }, [isAvailable, serviceType]); // Added serviceType dependency


    // Realtime Subscription
    useEffect(() => {
        if (!isAvailable) return;

        const channel = supabase
            .channel('radar-requests')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'service_requests', filter: 'status=eq.pending' },
                (payload) => {
                    const newReq = payload.new;
                    // Filter by service type if needed (client side filter for realtime)
                    if (serviceType && newReq.service_type !== serviceType) return;

                    setRequests(prev => [newReq, ...prev]);
                    // Instead of toast spam, increment counter
                    setNewRequestCount(prev => prev + 1);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isAvailable, supabase, serviceType]);

    const handleOffer = async () => {
        if (!selectedRequest || !offerPrice) return;
        setIsSubmitting(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            const { error } = await supabase.from("offers").insert({
                request_id: selectedRequest.id,
                driver_id: user.id,
                offered_price: parseFloat(offerPrice),
                status: "pending",
                offer_type: "initial",
                expires_at: new Date(Date.now() + 5 * 60000).toISOString()
            });

            if (error) throw error;

            setSelectedRequest(null);
            setOfferPrice("");
            toast.success("Oferta enviada");

        } catch (err) {
            const { message } = parseSupabaseError(err);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-100">
            {/* Header / Controls */}
            <div className="bg-white p-4 shadow-sm z-10 sticky top-0">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">Radar {serviceType === 'taxi' ? 'Taxi' : 'Mandadito'}</h1>
                    {/* Switch removed as parent controls availability */}
                </div>

                {isAvailable && (
                    <div className="flex justify-between items-center bg-blue-50 p-2 rounded text-sm text-blue-800">

                        <span>
                            {newRequestCount > 0
                                ? `${newRequestCount} nueva(s) solicitud(es)`
                                : "Buscando servicios cercanos..."}
                        </span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={fetchRequests}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                )}
            </div>

            {/* List / Job Board */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!isAvailable ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                        <p>Conéctate para ver solicitudes.</p>
                    </div>
                ) : loading ? (
                    <RequestCardSkeletonList count={3} />
                ) : requests.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                        <Inbox className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p className="font-medium">No hay solicitudes disponibles</p>
                        <p className="text-xs mt-2">Los servicios aparecerán aquí automáticamente.</p>
                    </div>
                ) : (
                    <>
                        {requests.map((req) => (
                            <RequestCard key={req.id} request={req} onOffer={() => {
                                setSelectedRequest(req);
                                setOfferPrice(req.estimated_price?.toString() || "");
                            }} />
                        ))}
                    </>
                )}
            </div>

            {/* Offer Sheet */}
            <Sheet open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <SheetContent side="bottom" className="h-[50%]">
                    <SheetHeader>
                        <SheetTitle>Ofertar Viaje</SheetTitle>
                        <SheetDescription>
                            {selectedRequest?.origin_address}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                            <span className="text-sm">Tarifa sugerida:</span>
                            <span className="font-bold text-lg">${selectedRequest?.estimated_price}</span>
                        </div>

                        <div className="space-y-2">
                            <Label>Tu Precio</Label>
                            <Input
                                type="number"
                                value={offerPrice}
                                onChange={e => setOfferPrice(e.target.value)}
                                className="text-lg font-bold"
                            />
                        </div>

                        <Button className="w-full" onClick={handleOffer} disabled={isSubmitting}>
                            {isSubmitting ? "Enviando..." : "Enviar Oferta"}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
