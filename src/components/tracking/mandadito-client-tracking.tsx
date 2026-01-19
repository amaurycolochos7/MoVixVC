"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Package, CheckCircle, Circle, MapPin, Phone, Navigation, ShoppingBag, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServiceDriverLocation } from "@/hooks/useServiceDriverLocation";
import { ClientTrackingMap } from "@/components/maps/client-tracking-map";

interface StopItem {
    id: string;
    item_name: string;
    quantity: number;
    actual_cost: number | null;
    is_purchased: boolean;
    notes: string | null;
}

interface Stop {
    id: string;
    stop_order: number;
    address: string;
    instructions: string;
    status: string;
    stop_type: string;
    total_expense: number;
    items: StopItem[];
}

interface MandaditoClientTrackingProps {
    requestId: string;
    request: any;
    driver: any;
}

export function MandaditoClientTracking({ requestId, request, driver }: MandaditoClientTrackingProps) {
    const supabase = createClient();
    const router = useRouter();
    const [stops, setStops] = useState<Stop[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Fetch stops and items
    const fetchStopsAndItems = async () => {
        console.log("🔄 [Mandadito Client] Fetching stops and items...");
        try {
            const { data: stopsData, error: stopsError } = await supabase
                .from("request_stops")
                .select("*")
                .eq("request_id", requestId)
                .order("stop_order", { ascending: true });

            if (stopsError) throw stopsError;

            const stopsWithItems = await Promise.all(
                (stopsData || []).map(async (stop) => {
                    const { data: items } = await supabase
                        .from("stop_items")
                        .select("*")
                        .eq("stop_id", stop.id)
                        .order("item_order", { ascending: true });

                    return { ...stop, items: items || [] };
                })
            );

            console.log("✅ [Mandadito Client] Loaded", stopsWithItems.length, "stops");
            setStops(stopsWithItems);
        } catch (err: any) {
            console.error("❌ [Mandadito Client] Error fetching stops:", err);
            toast.error("Error al cargar las compras");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log("🚀 [Mandadito Client] Initial load for request:", requestId);
        fetchStopsAndItems();

        const channel = supabase
            .channel(`mandadito-client-${requestId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "stop_items" },
                (payload) => {
                    console.log("📦 [Mandadito Client] stop_items changed:", payload);
                    fetchStopsAndItems();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "request_stops", filter: `request_id=eq.${requestId}` },
                (payload) => {
                    console.log("📍 [Mandadito Client] request_stops changed:", payload);
                    fetchStopsAndItems();
                }
            )
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "service_requests", filter: `id=eq.${requestId}` },
                (payload) => {
                    console.log("🔔 [Mandadito Client] service_requests changed:", payload);
                    if (payload.new.status === 'in_progress') {
                        toast.success("¡El mandadito va en camino a tu domicilio!");
                    } else if (payload.new.status === 'completed') {
                        toast.success("¡Servicio completado! Gracias por tu compra 🎉", {
                            duration: 3000,
                        });
                        setTimeout(() => {
                            window.location.href = '/cliente';
                        }, 2000);
                    } else if (payload.new.status === 'cancelled') {
                        toast.error("El servicio ha sido cancelado");
                        setTimeout(() => {
                            window.location.href = '/cliente';
                        }, 2000);
                    }
                }
            )
            .subscribe((status) => {
                console.log("📡 [Mandadito Client] Subscription status:", status);
            });

        // Polling backup
        const pollInterval = setInterval(() => {
            fetchStopsAndItems();
        }, 3000);

        return () => {
            console.log("🔌 [Mandadito Client] Unsubscribing from channels");
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [requestId]);

    // Cancel service handler
    const handleCancelService = async () => {
        setCancelling(true);
        try {
            const { error } = await supabase
                .from("service_requests")
                .update({
                    status: "cancelled",
                    cancellation_reason: "Cliente canceló el mandadito",
                    updated_at: new Date().toISOString()
                })
                .eq("id", requestId);

            if (error) throw error;

            toast.success("Servicio cancelado");
            setShowCancelModal(false);
            router.push("/cliente");
        } catch (err: any) {
            console.error("Error cancelling:", err);
            toast.error("Error al cancelar el servicio");
        } finally {
            setCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (request.status === 'completed') {
        toast.success("¡Servicio completado! Redirigiendo...", { duration: 2000 });
        setTimeout(() => {
            window.location.href = '/cliente';
        }, 2000);
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Servicio Completado!</h1>
                    <p className="text-gray-600">Gracias por tu compra 🎉</p>
                </div>
            </div>
        );
    }

    // Calculate total from items directly
    const totalExpenses = stops.reduce((acc, stop) => {
        const stopTotal = stop.items.reduce((itemAcc, item) => {
            return itemAcc + (item.actual_cost || 0);
        }, 0);
        return acc + stopTotal;
    }, 0);

    const serviceFee = request.service_fee || 28;
    const grandTotal = totalExpenses + serviceFee;

    // Check if any products have been marked as purchased
    const anyProductsPurchased = stops.some(stop =>
        stop.items.some(item => item.is_purchased)
    );

    // Can cancel only if in 'assigned' status AND no products purchased yet
    const canCancel = request.status === 'assigned' && !anyProductsPurchased;

    // Show delivery view when in_progress - with PIN and real-time map
    if (request.status === 'in_progress') {
        // Client destination coordinates
        const clientLocation = {
            lat: request.delivery_lat || request.origin_lat || 0,
            lng: request.delivery_lng || request.origin_lng || 0
        };

        return (
            <MandaditoDeliveryView
                requestId={requestId}
                request={request}
                driver={driver}
                totalExpenses={totalExpenses}
                serviceFee={serviceFee}
                grandTotal={grandTotal}
                clientLocation={clientLocation}
            />
        );
    }

    // Shopping phase UI (status = 'assigned')
    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white">
                                {request.mandadito_type === 'shopping' ? 'Compras' : 'Mandadito'}
                            </h1>
                            <p className="text-orange-100 text-xs">{driver?.full_name || 'Mandadito asignado'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canCancel && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2"
                                onClick={() => setShowCancelModal(true)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className="bg-white text-orange-600 hover:bg-orange-50 h-8 px-3 text-xs font-medium"
                            onClick={() => window.open(`tel:${driver?.phone}`)}
                        >
                            <Phone className="h-3.5 w-3.5 mr-1" />
                            Llamar
                        </Button>
                    </div>
                </div>
            </div>

            {/* Delivery Address */}
            {request.delivery_address && (
                <div className="bg-white px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <p className="text-sm text-gray-700 truncate">{request.delivery_address}</p>
                    </div>
                </div>
            )}

            {/* Shopping List */}
            <div className="p-4">
                <h2 className="font-semibold text-sm mb-3 flex items-center gap-2 text-gray-600">
                    <Package className="h-4 w-4" />
                    Lista de Compras
                </h2>

                {stops.length === 0 ? (
                    <div className="bg-gray-100 rounded-xl p-6 text-center">
                        <Package className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-500 text-sm">Sin productos</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {stops.map((stop, idx) => (
                            <div key={stop.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                {/* Stop Header */}
                                <div className="flex items-center gap-2 p-3 bg-gray-50">
                                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">
                                        {idx + 1}
                                    </div>
                                    <p className="font-medium text-sm text-gray-900 flex-1 truncate">
                                        {stop.address || `Parada ${idx + 1}`}
                                    </p>
                                    <span className="text-orange-400 font-semibold text-sm">
                                        ${stop.items.reduce((acc, item) => acc + (item.actual_cost || 0), 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Items */}
                                <div className="divide-y divide-gray-100">
                                    {stop.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`flex items-center gap-2 px-3 py-2 ${item.is_purchased ? "bg-green-50" : ""
                                                }`}
                                        >
                                            {item.is_purchased ? (
                                                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                                            ) : (
                                                <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-gray-900 text-sm truncate">
                                                    {item.item_name}
                                                    {item.quantity > 1 && (
                                                        <span className="text-gray-500 ml-1">x{item.quantity}</span>
                                                    )}
                                                </p>
                                            </div>
                                            {item.is_purchased && item.actual_cost ? (
                                                <span className="text-green-400 font-medium text-sm">
                                                    ${item.actual_cost.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">---</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Compact Bottom Footer */}
            <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
                <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-gray-500 text-xs block mb-1">Servicio</span>
                            <span className="text-gray-900 font-semibold text-base">${serviceFee.toFixed(2)}</span>
                        </div>
                        <div className="w-px h-10 bg-gray-200" />
                        <div>
                            <span className="text-gray-500 text-xs block mb-1">Compras</span>
                            <span className="text-orange-500 font-semibold text-base">${totalExpenses.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="bg-orange-500 rounded-xl px-5 py-3">
                        <span className="text-white/80 text-xs block mb-0.5">Total</span>
                        <span className="text-white font-bold text-xl">${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Cancel Modal */}
            <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
                <DialogContent className="sm:max-w-md bg-white border-gray-200">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            ¿Cancelar servicio?
                        </DialogTitle>
                        <DialogDescription className="text-gray-600">
                            Esta acción cancelará tu solicitud de mandadito. El mandadito será notificado.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-3 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowCancelModal(false)}
                            className="flex-1 border-gray-300 text-gray-700"
                        >
                            Volver
                        </Button>
                        <Button
                            onClick={handleCancelService}
                            disabled={cancelling}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, cancelar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Separate component for delivery view with map
interface MandaditoDeliveryViewProps {
    requestId: string;
    request: any;
    driver: any;
    totalExpenses: number;
    serviceFee: number;
    grandTotal: number;
    clientLocation: { lat: number; lng: number };
}

function MandaditoDeliveryView({
    requestId,
    request,
    driver,
    totalExpenses,
    serviceFee,
    grandTotal,
    clientLocation
}: MandaditoDeliveryViewProps) {
    return (
        <div className="h-screen flex flex-col bg-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 shrink-0 z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Navigation className="h-6 w-6 text-white animate-pulse" />
                        <div>
                            <h1 className="font-bold text-lg">En camino a tu domicilio</h1>
                            <p className="text-blue-100 text-sm">{driver?.full_name || 'Mandadito'}</p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="bg-white text-blue-600 hover:bg-blue-50"
                        onClick={() => window.open(`tel:${driver?.phone}`)}
                    >
                        <Phone className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Map - ClientTrackingMap handles driver location internally */}
            <div className="flex-1 relative">
                <ClientTrackingMap
                    serviceId={requestId}
                    pickupLocation={clientLocation}
                    dropoffLocation={clientLocation}
                    trackingStep="on_the_way"
                    className="w-full h-full"
                />
            </div>

            {/* Bottom Sheet */}
            <div className="bg-white/95 backdrop-blur-sm p-4 border-t border-gray-200 shrink-0 z-10 shadow-lg" style={{ marginBottom: '64px' }}>
                {/* PIN Display - Compact */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-xs">Tu PIN de entrega</p>
                            <p className="text-white font-bold text-2xl tracking-widest">
                                {request.boarding_pin || '----'}
                            </p>
                        </div>
                        <div className="text-orange-100 text-xs text-right max-w-[120px]">
                            Proporciona este PIN al mandadito
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="bg-gray-50 rounded-xl p-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <p className="text-xs text-gray-600 mb-0.5">Servicio</p>
                            <p className="text-gray-900 font-semibold">${serviceFee.toFixed(2)}</p>
                        </div>
                        <div className="border-x border-gray-300">
                            <p className="text-xs text-gray-600 mb-0.5">Compras</p>
                            <p className="text-gray-900 font-semibold">${totalExpenses.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600 mb-0.5">Total</p>
                            <p className="text-orange-400 font-bold text-lg">${grandTotal.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
