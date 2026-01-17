"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft, MapPin, Package, CheckCircle, Circle,
    Loader2, Navigation, ChevronDown, ChevronUp, DollarSign,
    ShoppingBag, Check, SkipForward, Phone, X, AlertTriangle,
    ExternalLink, KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DriverNavigationMap } from "@/components/maps/driver-navigation-map";
import { useDriverLocation } from "@/hooks/useDriverLocation";

interface StopItem {
    id: string;
    item_name: string;
    quantity: number;
    notes: string;
    actual_cost: number | null;
    is_purchased: boolean;
    purchase_notes: string | null;
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

interface MandaditoRequest {
    id: string;
    client_id: string;
    status: string;
    mandadito_type: string;
    delivery_address: string;
    delivery_references: string;
    delivery_lat: number;
    delivery_lng: number;
    origin_address: string;
    origin_lat: number;
    origin_lng: number;
    notes: string;
    service_fee: number;
    total_shopping_cost: number;
    boarding_pin: string | null;
    client?: {
        full_name: string;
        phone: string;
    };
}

export default function MandaditoServicePage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const requestId = params.id as string;

    const [request, setRequest] = useState<MandaditoRequest | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedStop, setExpandedStop] = useState<string | null>(null);
    const [updatingItem, setUpdatingItem] = useState<string | null>(null);

    // PIN and Cancel modals
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState("");
    const [verifyingPin, setVerifyingPin] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // GPS for driver
    const { currentPosition: driverLocation } = useDriverLocation({ serviceId: requestId });

    // Fetch request and stops
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: reqData, error: reqError } = await supabase
                    .from("service_requests")
                    .select(`
                        *,
                        client:users!client_id(full_name, phone)
                    `)
                    .eq("id", requestId)
                    .single();

                if (reqError) throw reqError;

                if (reqData.status === 'cancelled') {
                    toast.error("Este servicio está cancelado");
                    router.push("/mandadito");
                    return;
                }

                setRequest(reqData);

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

                setStops(stopsWithItems);

                const firstPending = stopsWithItems.find(s => s.status === 'pending' || s.status === 'in_progress');
                if (firstPending) setExpandedStop(firstPending.id);

            } catch (err: any) {
                console.error("Error fetching mandadito:", err);
                toast.error("Error al cargar el servicio");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        const channel = supabase
            .channel(`mandadito-service-${requestId}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "service_requests", filter: `id=eq.${requestId}` },
                (payload) => {
                    if (payload.new.status === 'cancelled') {
                        toast.error("Este servicio ha sido cancelado");
                        router.push("/mandadito");
                        return;
                    }
                    fetchData();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "request_stops", filter: `request_id=eq.${requestId}` },
                () => fetchData()
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "stop_items" },
                () => fetchData()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [requestId, supabase]);

    // Mark item as purchased
    const markItemPurchased = async (stopId: string, itemId: string, cost: number) => {
        setUpdatingItem(itemId);
        try {
            const { error } = await supabase
                .from("stop_items")
                .update({
                    is_purchased: true,
                    actual_cost: cost,
                    purchased_at: new Date().toISOString(),
                })
                .eq("id", itemId);

            if (error) throw error;

            setStops(stops.map(s =>
                s.id === stopId
                    ? {
                        ...s,
                        items: s.items.map(i =>
                            i.id === itemId
                                ? { ...i, is_purchased: true, actual_cost: cost }
                                : i
                        ),
                    }
                    : s
            ));

            toast.success("Producto registrado");
        } catch (err: any) {
            toast.error("Error al registrar producto");
        } finally {
            setUpdatingItem(null);
        }
    };

    // Complete a stop
    const completeStop = async (stopId: string) => {
        try {
            const { error } = await supabase
                .from("request_stops")
                .update({
                    status: "completed",
                    completed_at: new Date().toISOString(),
                })
                .eq("id", stopId);

            if (error) throw error;

            setStops(stops.map(s =>
                s.id === stopId ? { ...s, status: "completed" } : s
            ));

            const nextPending = stops.find(s => s.id !== stopId && s.status === 'pending');
            if (nextPending) setExpandedStop(nextPending.id);

            toast.success("Parada completada");
        } catch (err: any) {
            toast.error("Error al completar parada");
        }
    };

    // Skip a stop
    const skipStop = async (stopId: string) => {
        try {
            const { error } = await supabase
                .from("request_stops")
                .update({
                    status: "skipped",
                    completed_at: new Date().toISOString(),
                })
                .eq("id", stopId);

            if (error) throw error;

            setStops(stops.map(s =>
                s.id === stopId ? { ...s, status: "skipped" } : s
            ));

            toast.info("Parada saltada");
        } catch (err: any) {
            toast.error("Error al saltar parada");
        }
    };

    // Start delivery
    const startDelivery = async () => {
        try {
            const { error } = await supabase
                .from("service_requests")
                .update({
                    status: "in_progress",
                    started_at: new Date().toISOString(),
                })
                .eq("id", requestId);

            if (error) throw error;

            // Update local state to trigger re-render with map view
            setRequest((prev: any) => ({
                ...prev,
                status: "in_progress",
                started_at: new Date().toISOString(),
            }));

            toast.success("¡En camino a entregar!");
        } catch (err: any) {
            toast.error("Error al iniciar entrega");
        }
    };

    // Verify PIN and complete service
    const verifyPinAndComplete = async () => {
        if (pinInput.length !== 4) {
            toast.error("El PIN debe ser de 4 dígitos");
            return;
        }

        setVerifyingPin(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            console.log("🔐 Verifying PIN:", { requestId, pin: pinInput, driverId: user.id });

            const { data, error } = await supabase.rpc("validate_mandadito_delivery_pin", {
                p_request_id: requestId,
                p_pin: pinInput,
                p_driver_id: user.id,
            });

            console.log("📦 RPC Response:", { data, error });

            if (error) {
                console.error("RPC Error:", error);
                toast.error(`Error: ${error.message}`);
                return;
            }

            if (data?.success) {
                toast.success(`¡Servicio completado! Ganaste $${data.earnings?.toFixed(2) || '0.00'}`);
                setShowPinModal(false);

                // Keep driver available after completing service
                await supabase
                    .from("users")
                    .update({ is_available: true })
                    .eq("id", user.id);

                router.push("/mandadito");
            } else {
                toast.error(data?.error || "PIN incorrecto");
            }
        } catch (err: any) {
            console.error("Error verifying PIN:", err);
            toast.error(`Error: ${err.message || 'Error al verificar PIN'}`);
        } finally {
            setVerifyingPin(false);
        }
    };

    // Cancel service
    const handleCancelService = async () => {
        setCancelling(true);
        try {
            const { error } = await supabase
                .from("service_requests")
                .update({
                    status: "cancelled",
                    cancellation_reason: "Mandadero canceló el servicio",
                    updated_at: new Date().toISOString()
                })
                .eq("id", requestId);

            if (error) throw error;

            toast.success("Servicio cancelado");
            setShowCancelModal(false);
            router.push("/mandadito");
        } catch (err: any) {
            console.error("Error cancelling:", err);
            toast.error("Error al cancelar");
        } finally {
            setCancelling(false);
        }
    };

    // Open in external maps
    const openInMaps = () => {
        if (!request) return;
        const lat = request.delivery_lat || request.origin_lat;
        const lng = request.delivery_lng || request.origin_lng;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!request) {
        return (
            <div className="min-h-screen bg-white p-6">
                <p className="text-gray-900">Servicio no encontrado</p>
            </div>
        );
    }

    const allStopsComplete = stops.every(s => s.status === 'completed' || s.status === 'skipped');

    // Calculate total from items directly
    const totalExpenses = stops.reduce((acc, stop) => {
        const stopTotal = stop.items.reduce((itemAcc, item) => {
            return itemAcc + (item.actual_cost || 0);
        }, 0);
        return acc + stopTotal;
    }, 0);

    const serviceFee = request.service_fee || 28;
    const grandTotal = totalExpenses + serviceFee;

    // Check if any products have been purchased
    const anyProductsPurchased = stops.some(stop =>
        stop.items.some(item => item.is_purchased)
    );

    // Can only cancel if no products marked
    const canCancel = !anyProductsPurchased;

    // Navigation view when delivering (in_progress)
    if (request.status === 'in_progress') {
        // Destination coordinates (where to deliver)
        const deliveryDestination = {
            lat: request.delivery_lat || request.origin_lat || 0,
            lng: request.delivery_lng || request.origin_lng || 0
        };

        // Use a dummy pickup for the map (not used in trip phase)
        const dummyPickup = driverLocation || deliveryDestination;

        return (
            <div className="h-screen flex flex-col bg-white">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4 shrink-0 z-10 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                                <Navigation className="h-6 w-6 text-white animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="font-bold text-lg text-white">En camino al cliente</h1>
                                <p className="text-blue-100 text-sm truncate">{request.delivery_address}</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="bg-white text-blue-600 hover:bg-blue-50 shadow-md flex-shrink-0"
                            onClick={() => window.open(`tel:${request.client?.phone}`)}
                        >
                            <Phone className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Map - Takes remaining space */}
                <div className="flex-1 relative">
                    {/* GPS status overlay when waiting */}
                    {!driverLocation && (
                        <div className="absolute top-4 left-4 right-4 z-20 bg-yellow-400 text-gray-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Obteniendo tu ubicación GPS...
                        </div>
                    )}
                    <DriverNavigationMap
                        pickupLocation={dummyPickup}
                        dropoffLocation={deliveryDestination}
                        driverLocation={driverLocation || undefined}
                        className="w-full h-full"
                        trackingStep="picked_up"
                    />
                </div>

                {/* Bottom Panel - Fixed above nav */}
                <div className="bg-white border-t border-gray-200 p-5 shrink-0 z-10 shadow-2xl" style={{ marginBottom: '64px' }}>
                    {/* Summary Card */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-4 border border-gray-200">
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                                <p className="text-xs text-gray-600 mb-1 font-medium">Servicio</p>
                                <p className="text-gray-900 font-bold text-lg">${serviceFee.toFixed(2)}</p>
                            </div>
                            <div className="border-x border-gray-300">
                                <p className="text-xs text-gray-600 mb-1 font-medium">Compras</p>
                                <p className="text-gray-900 font-bold text-lg">${totalExpenses.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 mb-1 font-medium">Total</p>
                                <p className="text-orange-500 font-bold text-xl">${grandTotal.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Complete Button */}
                    <Button
                        className="w-full h-14 text-base bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 font-bold shadow-lg"
                        onClick={() => setShowPinModal(true)}
                    >
                        <KeyRound className="h-5 w-5 mr-2" />
                        Confirmar Entrega con PIN
                    </Button>
                </div>

                {/* PIN Modal */}
                <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
                    <DialogContent className="sm:max-w-md bg-white border-gray-200">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5 text-orange-500" />
                                Ingresa el PIN del cliente
                            </DialogTitle>
                            <DialogDescription className="text-gray-600">
                                Solicita el PIN de 4 dígitos al cliente para confirmar la entrega.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4">
                            <Input
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                placeholder="0000"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                                className="text-center text-3xl tracking-widest h-16 bg-gray-50 border-gray-300 font-bold"
                                autoFocus
                            />
                        </div>

                        <DialogFooter className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowPinModal(false);
                                    setPinInput("");
                                }}
                                className="flex-1 border-gray-300 text-gray-700"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={verifyPinAndComplete}
                                disabled={verifyingPin || pinInput.length !== 4}
                                className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                                {verifyingPin ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-1" />
                                        Confirmar
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Shopping phase UI (status = 'assigned')
    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <div className="bg-white p-5 border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <button
                        onClick={() => router.push("/mandadito")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="h-5 w-5" /> Radar
                    </button>
                    <div className="flex items-center gap-2">
                        {canCancel && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setShowCancelModal(true)}
                            >
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                            </Button>
                        )}
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => window.open(`tel:${request.client?.phone}`)}
                        >
                            <Phone className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                    {request.mandadito_type === "shopping" ? "🛒 Compras" : "📦 Envío"}
                </h1>
                <p className="text-gray-600 text-sm">
                    {request.client?.full_name} • {request.client?.phone}
                </p>
            </div>

            {/* Expense Summary Banner */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-500 p-5 flex justify-between items-center">
                <div>
                    <p className="text-orange-100 text-xs mb-1">Total compras</p>
                    <p className="text-3xl font-bold text-white">${totalExpenses.toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <p className="text-orange-100 text-xs mb-1">Tu tarifa</p>
                    <p className="text-3xl font-bold text-white">${serviceFee}</p>
                </div>
            </div>

            {/* Stops Timeline */}
            <div className="p-5 space-y-4">
                <h2 className="font-bold text-lg flex items-center gap-2 text-gray-900">
                    <MapPin className="h-5 w-5 text-orange-400" />
                    Paradas ({stops.length})
                </h2>

                {stops.map((stop, index) => {
                    const isExpanded = expandedStop === stop.id;
                    const isCompleted = stop.status === 'completed';
                    const isSkipped = stop.status === 'skipped';
                    const allItemsPurchased = stop.items.every(i => i.is_purchased);

                    return (
                        <Card
                            key={stop.id}
                            className={`overflow-hidden border shadow-sm ${isCompleted
                                ? "border-green-200 bg-green-50"
                                : isSkipped
                                    ? "border-gray-300 bg-gray-100 opacity-60"
                                    : "border-gray-200 bg-white"
                                }`}
                        >
                            {/* Stop Header */}
                            <div
                                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                                onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted
                                    ? "bg-green-500"
                                    : isSkipped
                                        ? "bg-slate-600"
                                        : "bg-orange-500"
                                    }`}>
                                    {isCompleted ? (
                                        <CheckCircle className="h-5 w-5 text-white" />
                                    ) : isSkipped ? (
                                        <SkipForward className="h-5 w-5 text-white" />
                                    ) : (
                                        <span className="font-bold text-white">{index + 1}</span>
                                    )}
                                </div>

                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{stop.address || `Parada ${index + 1}`}</p>
                                    <p className="text-xs text-gray-600">
                                        {stop.items.length} producto(s) • Total: ${stop.items.reduce((acc, i) => acc + (i.actual_cost || 0), 0).toFixed(2)}
                                    </p>
                                </div>

                                {isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-gray-500" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-gray-500" />
                                )}
                            </div>

                            {/* Stop Content */}
                            {isExpanded && (
                                <div className="p-4 pt-0 border-t border-gray-200 space-y-3">
                                    {stop.instructions && (
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                            <p className="text-xs text-blue-700 font-medium mb-1">Instrucciones:</p>
                                            <p className="text-sm text-gray-900">{stop.instructions}</p>
                                        </div>
                                    )}

                                    {stop.items.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-xs text-gray-700 font-medium">Lista de compras:</p>
                                            {stop.items.map((item) => (
                                                <ItemChecker
                                                    key={item.id}
                                                    item={item}
                                                    onMarkPurchased={(cost) => markItemPurchased(stop.id, item.id, cost)}
                                                    isUpdating={updatingItem === item.id}
                                                    disabled={isCompleted || isSkipped}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {!isCompleted && !isSkipped && (
                                        <div className="flex gap-2 pt-3">
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                                                onClick={() => skipStop(stop.id)}
                                            >
                                                <SkipForward className="h-4 w-4 mr-1" /> Saltar
                                            </Button>
                                            <Button
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                                onClick={() => completeStop(stop.id)}
                                                disabled={!allItemsPurchased && stop.items.length > 0}
                                            >
                                                <Check className="h-4 w-4 mr-1" /> Completar
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    );
                })}

                {/* Delivery Destination */}
                {request.mandadito_type === "shopping" && (
                    <Card className="bg-white border-2 border-blue-200 p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                                <Navigation className="h-6 w-6 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Entregar en</p>
                                <p className="font-semibold text-gray-900 text-base mb-1">{request.delivery_address}</p>
                                {request.delivery_references && (
                                    <p className="text-sm text-gray-600 mt-2 flex items-start gap-2">
                                        <span className="text-gray-400">📍</span>
                                        <span>{request.delivery_references}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Fixed Bottom Action */}
            <div className="fixed bottom-16 left-0 right-0 p-5 bg-white border-t border-gray-200 shadow-lg">
                {!allStopsComplete ? (
                    <div className="text-center text-gray-600 py-2">
                        Completa todas las paradas para continuar
                    </div>
                ) : request.status === 'assigned' ? (
                    <Button
                        className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
                        onClick={startDelivery}
                    >
                        <Navigation className="h-5 w-5 mr-2" />
                        Iniciar viaje al domicilio
                    </Button>
                ) : null}
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
                            Esta acción cancelará el servicio y el cliente será notificado.
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

// Item Checker Component
function ItemChecker({
    item,
    onMarkPurchased,
    isUpdating,
    disabled,
}: {
    item: StopItem;
    onMarkPurchased: (cost: number) => void;
    isUpdating: boolean;
    disabled: boolean;
}) {
    const [cost, setCost] = useState<string>(item.actual_cost?.toString() || "");
    const [showInput, setShowInput] = useState(false);

    if (item.is_purchased) {
        return (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div className="flex-1">
                    <p className="text-gray-900">
                        {item.item_name} {item.quantity > 1 && `(x${item.quantity})`}
                    </p>
                </div>
                <span className="font-bold text-green-600">${item.actual_cost?.toFixed(2)}</span>
            </div>
        );
    }

    if (showInput && !disabled) {
        return (
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-gray-900 mb-2">
                    {item.item_name} {item.quantity > 1 && `(x${item.quantity})`}
                </p>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <Input
                            type="number"
                            placeholder="Costo"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            className="pl-8 bg-white border-gray-300"
                            autoFocus
                        />
                    </div>
                    <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => onMarkPurchased(parseFloat(cost) || 0)}
                        disabled={isUpdating || !cost}
                    >
                        {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 ${disabled ? "opacity-50" : "cursor-pointer hover:border-orange-400"
                }`}
            onClick={() => !disabled && setShowInput(true)}
        >
            <Circle className="h-5 w-5 text-gray-400" />
            <div className="flex-1">
                <p className="text-gray-900">
                    {item.item_name} {item.quantity > 1 && `(x${item.quantity})`}
                </p>
                {item.notes && <p className="text-xs text-gray-500">{item.notes}</p>}
            </div>
            {!disabled && (
                <span className="text-xs text-orange-500 font-medium">Toca para registrar $</span>
            )}
        </div>
    );
}
