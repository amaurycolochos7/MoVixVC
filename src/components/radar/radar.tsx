"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { RequestCard } from "./request-card";
import { RequestCardSkeletonList } from "./request-card-skeleton";
import { MapPreviewModal } from "./map-preview-modal";
import { RefreshCw, Inbox, Loader2 } from "lucide-react";
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
    const router = useRouter();
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [acceptingRequest, setAcceptingRequest] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [offerPrice, setOfferPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newRequestCount, setNewRequestCount] = useState(0);
    // Map preview state - persists across re-renders
    const [mapPreviewRequest, setMapPreviewRequest] = useState<any | null>(null);

    /* Removed initial status check - parent handles auth/status checks implicitly or explicitly */

    // Initial Fetch - smarter to prevent re-renders when data hasn't changed
    const fetchRequests = async (isPolling = false) => {
        // Only show loading on initial fetch, not on polling
        if (!isPolling) setLoading(true);

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

            // Only update if data actually changed (prevents modal from closing)
            if (data) {
                setRequests(prev => {
                    const prevIds = prev.map(r => r.id).join(',');
                    const newIds = data.map((r: any) => r.id).join(',');
                    if (prevIds !== newIds) {
                        return data;
                    }
                    return prev;
                });
            }
        } catch (err) {
            if (!isPolling) {
                const { message } = parseSupabaseError(err);
                toast.error(message);
            }
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    // Initial fetch and AUTOMATIC POLLING every 5 seconds
    useEffect(() => {
        if (!isAvailable) return;

        // Fetch immediately (not polling mode)
        fetchRequests(false);

        // Poll every 3 seconds for faster updates
        const pollInterval = setInterval(() => {
            fetchRequests(true);
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [isAvailable, serviceType]);


    // Realtime Subscription (as backup/instant notification)
    useEffect(() => {
        if (!isAvailable) return;

        const channel = supabase
            .channel('radar-requests')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'service_requests', filter: 'status=eq.pending' },
                (payload) => {
                    const newReq = payload.new;
                    if (serviceType && newReq.service_type !== serviceType) return;
                    setRequests(prev => [newReq, ...prev]);
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

    // Direct accept - takes service at listed price immediately
    const handleDirectAccept = async (req: any) => {
        setAcceptingRequest(req.id);
        console.log("🚀 Starting direct accept for request:", req.id);

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");
            console.log("👤 Driver ID:", user.id);

            // Base fares: Taxi $33, Mandadito $22
            const defaultPrice = req.service_type === "mandadito" ? 22 : 33;
            const price = req.estimated_price || defaultPrice;

            // Create offer at listed price
            console.log("📝 Creating offer...");
            const { data: offer, error: offerError } = await supabase.from("offers").insert({
                request_id: req.id,
                driver_id: user.id,
                offered_price: price,
                status: "accepted",
                offer_type: "initial",
                expires_at: new Date(Date.now() + 60 * 60000).toISOString()
            }).select().single();

            if (offerError) {
                console.error("❌ Error creating offer:", offerError);
                throw offerError;
            }
            console.log("✅ Offer created:", offer?.id);

            // Assign self as driver
            console.log("📝 Updating service_request...");
            const { data: updatedRequest, error: updateError } = await supabase
                .from("service_requests")
                .update({
                    status: "assigned",
                    assigned_driver_id: user.id,
                    final_price: price
                })
                .eq("id", req.id)
                .select()
                .single();

            if (updateError) {
                console.error("❌ Error updating request:", updateError);
                throw updateError;
            }

            console.log("✅ Request updated:", updatedRequest);
            console.log("   Status:", updatedRequest?.status);
            console.log("   Driver:", updatedRequest?.assigned_driver_id);

            toast.success("Servicio aceptado");

            // Navigate to service execution page
            router.push(`/taxi/servicio/${req.id}`);

        } catch (err: any) {
            console.error("❌ handleDirectAccept error:", err);
            const { message } = parseSupabaseError(err);
            toast.error(message);
        } finally {
            setAcceptingRequest(null);
        }
    };

    return (
        <div className="h-full flex flex-col" style={{ backgroundColor: '#ffffff' }}>
            {/* Status bar - shows continuous searching animation */}
            {isAvailable && (
                <div className="p-3 border-b border-gray-100">
                    <div className="flex justify-between items-center bg-green-50 px-3 py-2 rounded-lg text-sm text-green-700">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="font-medium">
                                {requests.length > 0
                                    ? `${requests.length} solicitud(es) disponible(s)`
                                    : "Buscando viajes..."}
                            </span>
                        </div>
                        <RefreshCw className="h-4 w-4 animate-spin text-green-600" />
                    </div>
                </div>
            )}

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
                            <RequestCard
                                key={req.id}
                                request={req}
                                onOffer={() => {
                                    setSelectedRequest(req);
                                    setOfferPrice(req.estimated_price?.toString() || "");
                                }}
                                onAccept={() => handleDirectAccept(req)}
                                onShowMap={() => setMapPreviewRequest(req)}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Offer Modal - Forced Light Theme */}
            {selectedRequest && (
                <div
                    className="fixed inset-0 z-[100] flex flex-col"
                    style={{ backgroundColor: '#ffffff' }}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: '#ffffff' }}
                    >
                        <button
                            onClick={() => setSelectedRequest(null)}
                            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition"
                        >
                            <svg className="w-6 h-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h1 className="text-lg font-bold text-gray-900">Nueva Solicitud</h1>
                        <div className="w-10" />
                    </div>

                    {/* Content - scrollable with padding for footer */}
                    <div className="flex-1 overflow-y-auto p-4 pb-48 space-y-4">
                        {/* Service Type Badge */}
                        <div className="flex justify-center">
                            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold uppercase">
                                {selectedRequest.service_type === 'taxi' ? 'Servicio de Taxi' : 'Mandadito'}
                            </span>
                        </div>

                        {/* Route Card */}
                        <div className="bg-gray-50 rounded-2xl p-4 shadow-sm border border-gray-200">
                            <div className="flex gap-4">
                                {/* Timeline dots */}
                                <div className="flex flex-col items-center py-1">
                                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                    </div>
                                    <div className="w-0.5 flex-1 bg-gray-300 my-2" />
                                    <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                    </div>
                                </div>

                                {/* Addresses */}
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Origen</p>
                                        <p className="font-semibold text-lg mt-1">
                                            {selectedRequest.origin_neighborhood || selectedRequest.origin_address || "Ubicación GPS"}
                                        </p>
                                        {selectedRequest.origin_references && (
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {selectedRequest.origin_references}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Destino</p>
                                        <p className="font-semibold text-lg mt-1">
                                            {selectedRequest.destination_neighborhood || selectedRequest.destination_address || "Destino por confirmar"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Client Notes */}
                        {selectedRequest.notes && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <p className="text-sm font-medium text-amber-800">Nota del cliente</p>
                                <p className="text-amber-700 mt-1">{selectedRequest.notes}</p>
                            </div>
                        )}

                        {/* Price Info */}
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-emerald-100 text-sm font-medium">Tarifa del cliente</p>
                                    <p className="text-4xl font-bold mt-1">${selectedRequest.estimated_price?.toFixed(0) || "50"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-emerald-100 text-sm font-medium">Tiempo estimado</p>
                                    <p className="text-xl font-bold mt-1">~5 min</p>
                                </div>
                            </div>
                        </div>

                        {/* Your Offer Section */}
                        <div className="bg-gray-50 rounded-2xl p-4 shadow-sm border border-gray-200">
                            <p className="text-sm font-semibold text-gray-700 mb-3">
                                Tu contraoferta
                            </p>

                            {/* Price Input */}
                            <div className="relative mb-4">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-gray-400">$</div>
                                <Input
                                    type="number"
                                    value={offerPrice}
                                    onChange={e => setOfferPrice(e.target.value)}
                                    className="w-full h-16 text-3xl font-bold text-center pl-12 border-2 rounded-xl bg-white focus:ring-2 focus:ring-primary"
                                    placeholder="50"
                                />
                            </div>

                            {/* Quick Price Buttons */}
                            <div className="grid grid-cols-4 gap-2">
                                {[40, 50, 60, 70].map(price => (
                                    <Button
                                        key={price}
                                        variant={offerPrice === price.toString() ? "default" : "outline"}
                                        onClick={() => setOfferPrice(price.toString())}
                                        className="h-12 text-lg font-semibold rounded-xl"
                                    >
                                        ${price}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div
                        className="fixed bottom-0 left-0 right-0 p-4 pb-8 border-t border-gray-200 space-y-2"
                        style={{ backgroundColor: '#ffffff' }}
                    >
                        <Button
                            className="w-full h-14 text-lg font-bold rounded-xl shadow-lg"
                            onClick={handleOffer}
                            disabled={isSubmitting || !offerPrice}
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <span>Enviar Oferta de ${offerPrice || "0"}</span>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full h-10 text-gray-500"
                            onClick={() => setSelectedRequest(null)}
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}
            {/* Map Preview Modal - Uses new component with reverse geocoding */}
            {mapPreviewRequest && (
                <MapPreviewModal
                    request={mapPreviewRequest}
                    onClose={() => setMapPreviewRequest(null)}
                />
            )}
        </div>
    );
}
