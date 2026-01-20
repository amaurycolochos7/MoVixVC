"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { RequestCard } from "./request-card";
import { RequestCardSkeletonList } from "./request-card-skeleton";
import { MapPreviewModal } from "./map-preview-modal";
import { NegotiationModal } from "./negotiation-modal";
import { RefreshCw, Inbox, Loader2, Navigation, CheckCircle, Clock, Timer, MapPin, DollarSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useDriverLocation } from "@/hooks/useDriverLocation";
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

// Helper functions for ETA calculations
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateETA(distanceKm: number): number {
    return Math.ceil((distanceKm / 25) * 60); // minutes
}

export function Radar({ serviceType, isAvailable }: RadarProps) {
    const router = useRouter();
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [mapPreviewRequest, setMapPreviewRequest] = useState<any | null>(null);

    // Driver's GPS location for ETA calculations
    const [driverPosition, setDriverPosition] = useState<{ lat: number; lng: number } | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);

    // Initialize offer amount when a request is selected
    useEffect(() => {
        if (selectedRequest) {
            // FORCE $35 for taxi to override old requests with variable calculation
            // For mandadito, keep 22 or estimated
            const defaultPrice = selectedRequest.service_type === 'taxi'
                ? 35
                : (selectedRequest.estimated_price || 22);
            // setOfferAmount(defaultPrice); // This state is removed, so this line is commented out
        }
    }, [selectedRequest]);

    /* Removed initial status check - parent handles auth/status checks implicitly or explicitly */

    // Initial Fetch - smarter to prevent re-renders when data hasn't changed
    const fetchRequests = async (isPolling = false) => {
        // Only show loading on initial fetch, not on polling
        if (!isPolling) setLoading(true);

        try {
            let query = supabase
                .from("service_requests")
                .select(`
                    *,
                    request_stops (
                        id,
                        stop_order,
                        address,
                        instructions,
                        stop_items (
                            id,
                            item_name,
                            quantity
                        )
                    )
                `)
                .in("status", ["pending", "negotiating"])
                .eq("municipio", "Venustiano Carranza") // Local Filter MVP
                .gt("request_expires_at", new Date().toISOString()) // Filter expired
                .order("created_at", { ascending: false });

            if (serviceType) {
                // Mandadito drivers see both 'mandadito' and 'moto_ride'
                // Taxi drivers only see 'taxi'
                if (serviceType === 'mandadito') {
                    query = query.in("service_type", ["mandadito", "moto_ride"]);
                } else {
                    query = query.eq("service_type", serviceType);
                }
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
                async (payload) => {
                    const newReq = payload.new as any;
                    if (serviceType && newReq.service_type !== serviceType) return;

                    // Wait 2s to ensure stops are inserted by client (handling race condition)
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Fetch full details including stops and items because realtime payload is shallow
                    const { data: fullRequest } = await supabase
                        .from("service_requests")
                        .select(`
                            *,
                            request_stops (
                                id,
                                stop_order,
                                address,
                                instructions,
                                stop_items (
                                    id,
                                    item_name,
                                    quantity
                                )
                            )
                        `)
                        .eq("id", newReq.id)
                        .single();

                    console.log("🔍 RADAR REALTIME FETCH:", {
                        id: newReq.id,
                        stopsCount: fullRequest?.request_stops?.length,
                        fullRequest
                    });

                    if (fullRequest) {
                        setRequests(prev => [fullRequest, ...prev]);
                        // Play sound or notify?
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isAvailable, supabase, serviceType]);

    // handleOffer removed (unused and caused lint errors)

    // Send offer to client - creates offer record and waits for client to accept
    const handleSendOffer = async (req: any, offerPrice: number) => {
        console.log("📤 Sending offer to client for request:", req.id, "price:", offerPrice);

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            // Check if request is still available
            const { data: currentRequest, error: checkError } = await supabase
                .from("service_requests")
                .select("status")
                .eq("id", req.id)
                .single();

            if (checkError) throw checkError;

            if (currentRequest.status !== "pending") {
                toast.error("Esta solicitud ya no está disponible");
                setRequests(prev => prev.filter(r => r.id !== req.id));
                setSelectedRequest(null);
                return;
            }

            // Check if driver already sent an offer for this request
            const { data: existingOffer } = await supabase
                .from("offers")
                .select("id")
                .eq("request_id", req.id)
                .eq("driver_id", user.id)
                .eq("status", "pending")
                .single();

            if (existingOffer) {
                toast.info("Ya enviaste una oferta para esta solicitud");
                setSelectedRequest(null);
                return;
            }

            // Create offer as PENDING - wait for client to accept
            const { error: offerError } = await supabase.from("offers").insert({
                request_id: req.id,
                driver_id: user.id,
                offered_price: offerPrice,
                status: "pending",
                offer_type: "initial",
                expires_at: new Date(Date.now() + 5 * 60000).toISOString() // 5 minutes
            });

            if (offerError) {
                console.error("❌ Error creating offer:", offerError);
                throw offerError;
            }

            console.log("✅ Offer sent successfully!");
            toast.success("¡Oferta enviada!", {
                description: `El cliente verá tu oferta de $${offerPrice}`,
            });

            // Close modal and optionally remove from list (driver can still see it but knows they offered)
            setSelectedRequest(null);

        } catch (err: any) {
            console.error("❌ handleSendOffer error:", err);
            const { message } = parseSupabaseError(err);
            toast.error(message);
        }
    };

    // Direct accept - takes service at listed price immediately
    // Includes race condition check to handle multiple drivers accepting simultaneously
    const handleDirectAccept = async (req: any) => {
        // setAcceptingRequest(req.id); Remove undefined setter
        console.log("🚀 Starting direct accept for request:", req.id);

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");
            console.log("👤 Driver ID:", user.id);

            // === RACE CONDITION CHECK ===
            // First verify the request is still available (pending)
            const { data: currentRequest, error: checkError } = await supabase
                .from("service_requests")
                .select("status, assigned_driver_id")
                .eq("id", req.id)
                .single();

            if (checkError) {
                console.error("❌ Error checking request status:", checkError);
                throw checkError;
            }

            // If request is no longer pending, another driver got it first
            if (currentRequest.status !== "pending") {
                console.log("⚠️ Request already taken by another driver");
                toast.error("¡Otro conductor aceptó este viaje primero!", {
                    description: "La solicitud ya no está disponible",
                    duration: 4000,
                });

                // Remove from local list
                setRequests(prev => prev.filter(r => r.id !== req.id));
                return;
            }

            // Base fares: Taxi $35, Mandadito $22
            const defaultPrice = req.service_type === "mandadito" ? 22 : 35;
            const price = req.estimated_price || defaultPrice;

            // Create offer as PENDING (RPC will confirm it)
            console.log("📝 Creating offer...");
            const { data: offer, error: offerError } = await supabase.from("offers").insert({
                request_id: req.id,
                driver_id: user.id,
                offered_price: price,
                status: "pending",
                offer_type: "initial",
                expires_at: new Date(Date.now() + 60 * 60000).toISOString()
            }).select().single();

            if (offerError) {
                console.error("❌ Error creating offer:", offerError);
                throw offerError;
            }
            console.log("✅ Offer created:", offer?.id);

            // CALL RPC to handle assignment atomically
            console.log("⚡ Calling assign_driver_to_request RPC...");
            const { data: rpcResult, error: rpcError } = await supabase.rpc("assign_driver_to_request", {
                p_request_id: req.id,
                p_driver_id: user.id,
                p_offer_id: offer.id,
                p_expected_version: req.version || 1 // Fallback to 1 if not present
            });

            if (rpcError) {
                console.error("❌ RPC Error:", rpcError);
                throw rpcError;
            }

            // Check logic success from RPC
            // RPC returns: { success: boolean, error?: string, message?: string }
            if (!rpcResult.success) {
                console.error("❌ Assignment failed logic:", rpcResult);

                if (rpcResult.error === 'REQUEST_NOT_FOUND' || rpcResult.error === 'VERSION_CONFLICT' || rpcResult.error === 'INVALID_STATUS') {
                    toast.error("El viaje ya no está disponible", {
                        description: "Otro conductor lo tomó o fue cancelado"
                    });
                    setRequests(prev => prev.filter(r => r.id !== req.id));
                } else if (rpcResult.error === 'DRIVER_NOT_AVAILABLE') {
                    toast.error("No puedes tomar el viaje", {
                        description: "Parece que ya estás ocupado o no disponible"
                    });
                } else {
                    toast.error("No se pudo asignar el viaje", {
                        description: rpcResult.message || "Error desconocido"
                    });
                }
                return;
            }

            console.log("✅ Assignment successful via RPC:", rpcResult);
            toast.success("¡Servicio aceptado!");

            // Navigate to service execution page based on service type
            let servicePath: string;
            if (req.service_type === "moto_ride") {
                servicePath = `/moto-ride/servicio/${req.id}`;
            } else if (req.service_type === "mandadito") {
                servicePath = `/mandadito/servicio/${req.id}`;
            } else {
                servicePath = `/taxi/servicio/${req.id}`;
            }
            router.push(servicePath);

        } catch (err: any) {
            console.error("❌ handleDirectAccept error:", err);
            const { message } = parseSupabaseError(err);
            toast.error(message);
        } finally {
            // Cleanup if needed
        }
    };

    return (
        <div className="h-full flex flex-col" style={{ backgroundColor: '#ffffff' }}>
            {/* Status bar - shows GPS and searching status */}
            {/* Minimal GPS Error Status only */}
            {isAvailable && gpsError && (
                <div className="bg-amber-50 px-4 py-2 text-xs text-amber-700 border-b border-amber-100 flex items-center justify-center gap-2">
                    <span className="animate-pulse">⚠️ Warning:</span> {gpsError}
                </div>
            )}

            {/* List / Job Board */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
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
                                driverLocation={driverPosition}
                                onCardClick={() => {
                                    console.log("onCardClick handled in Radar", req.id);
                                    setSelectedRequest(req);
                                }}
                                onOffer={() => setSelectedRequest(req)}
                                onAccept={() => handleDirectAccept(req)}
                                onShowMap={() => setMapPreviewRequest(req)}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Map Preview Modal */}
            {mapPreviewRequest && (
                <MapPreviewModal
                    request={mapPreviewRequest}
                    onClose={() => setMapPreviewRequest(null)}
                />
            )}

            {/* MAIN NEGOTIATION MODAL - Restored */}
            {selectedRequest && (
                <NegotiationModal
                    request={selectedRequest}
                    driverLocation={driverPosition}
                    onClose={() => setSelectedRequest(null)}
                    onAccept={(req, price) => {
                        // Determine if it's a direct accept or an offer
                        // For Mandadito/Taxi: if price matches the listed/estimated price, treat as direct accept
                        const listedPrice = req.service_type === 'taxi' ? 35 : (req.estimated_price || 22);

                        // If price matches listed price (or no price provided, implying listed), DIRECT ACCEPT
                        if (!price || price === listedPrice) {
                            handleDirectAccept(req);
                        } else {
                            // Otherwise it's a counter-offer
                            handleSendOffer(req, price);
                        }
                    }}
                />
            )}
        </div>
    );
}
