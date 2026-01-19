"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft, MapPin, Package, CheckCircle, Circle,
    Loader2, Navigation, ChevronDown, ChevronUp, ChevronRight, DollarSign,
    ShoppingBag, Check, SkipForward, Phone, X, AlertTriangle,
    ExternalLink, KeyRound, MessageCircle,
    Navigation as NavigationIcon
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { DriverNavigationMap, DriverNavigationMapRef } from "@/components/maps/driver-navigation-map";
import { SimpleLocationMap } from "@/components/maps/simple-location-map";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useRef } from "react";

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
    lat?: number;
    lng?: number;
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
    const [cancelReason, setCancelReason] = useState("");

    // Map modal state
    const [selectedMapStop, setSelectedMapStop] = useState<Stop | null>(null);
    const [showDeliveryMap, setShowDeliveryMap] = useState(false);
    const [isNavigatingToStore, setIsNavigatingToStore] = useState(false);

    // GPS for driver
    const { currentPosition: driverLocation } = useDriverLocation({ serviceId: requestId });

    // Map Ref
    const mapRef = useRef<DriverNavigationMapRef>(null);

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
            const user = (await supabase.auth.getUser()).data.user;

            const { error } = await supabase
                .from("service_requests")
                .update({
                    status: "cancelled",
                    cancellation_reason: "Mandadito canceló el servicio",
                    updated_at: new Date().toISOString()
                })
                .eq("id", requestId);

            if (error) throw error;

            // Keep driver available after cancelling
            if (user) {
                await supabase
                    .from("users")
                    .update({ is_available: true })
                    .eq("id", user.id);
            }

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

        // Get client initials for avatar
        const getClientInitials = (name: string) => {
            if (!name) return "C";
            const parts = name.split(" ");
            return parts.length > 1
                ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
                : name.substring(0, 2).toUpperCase();
        };

        return (
            <div className="h-screen flex flex-col bg-gray-100">
                {/* Full Screen Map */}
                <div className="flex-1 relative">
                    {/* GPS status overlay when waiting */}
                    {!driverLocation && (
                        <div className="absolute top-20 left-4 right-4 z-30 bg-yellow-400 text-gray-900 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-lg">
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

                    {/* Compact Status Bar - Minimal footprint */}
                    <div className="absolute top-4 left-4 right-4 z-20">
                        <div className="bg-white/95 backdrop-blur-sm rounded-full shadow-lg px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-800 truncate">
                                    {request.client?.full_name || 'Cliente'}
                                </span>
                                <span className="text-gray-400 text-xs flex-shrink-0">• Entregar</span>
                            </div>

                            {/* Contact Buttons - Compact */}
                            <div className="flex gap-2">
                                {/* WhatsApp Button */}
                                <button
                                    onClick={() => {
                                        if (request.client?.phone) {
                                            const phone = request.client.phone.replace(/\D/g, ''); // Remove non-digits
                                            window.open(`https://wa.me/${phone}`, '_blank');
                                        }
                                    }}
                                    className="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#20BA5A] active:bg-[#1DA851] flex items-center justify-center shadow-md transition-all flex-shrink-0"
                                >
                                    <MessageCircle className="h-5 w-5 text-white" />
                                </button>

                                {/* Call Button */}
                                <button
                                    onClick={() => {
                                        if (request.client?.phone) {
                                            window.location.href = `tel:${request.client.phone}`;
                                        }
                                    }}
                                    className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 flex items-center justify-center shadow-md transition-all flex-shrink-0"
                                >
                                    <Phone className="h-5 w-5 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
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
                            className="bg-[#25D366] hover:bg-[#20BA5A]"
                            onClick={() => {
                                if (request.client?.phone) {
                                    const phone = request.client.phone.replace(/\D/g, '');
                                    window.open(`https://wa.me/${phone}`, '_blank');
                                }
                            }}
                        >
                            <MessageCircle className="h-4 w-4" />
                        </Button>
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
                                <div className="p-4 pt-0 border-t border-gray-200 space-y-4">
                                    {/* Navigation Buttons - Google Maps & Ver Mapa */}
                                    {/* Navigation Buttons - Compact & Aligned */}
                                    {stop.lat && stop.lng && (
                                        <div className="flex gap-2 pt-3">
                                            <Button
                                                className="flex-1 h-9 bg-[#10B981] hover:bg-[#059669] text-white shadow-sm rounded-lg text-xs font-medium border-0"
                                                onClick={() => setSelectedMapStop(stop)}
                                            >
                                                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                                                Ver Mapa
                                            </Button>
                                        </div>
                                    )}

                                    {/* LISTA DE COMPRAS */}
                                    {stop.items.length > 0 && (
                                        <div>
                                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">Lista de Compras</p>
                                            <div className="space-y-3">
                                                {stop.items.map((item) => (
                                                    <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white">
                                                        <span className="font-medium text-gray-800">{item.item_name}</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-gray-400 text-sm">$</span>
                                                            <input
                                                                type="number"
                                                                placeholder="0"
                                                                defaultValue={item.actual_cost || ""}
                                                                className="w-20 h-8 text-right font-medium border border-gray-200 rounded-md px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                                onBlur={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    if (!isNaN(val)) {
                                                                        markItemPurchased(stop.id, item.id, val);
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stop Actions - Saltar / Completar */}
                                    {!isCompleted && !isSkipped && (
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-10 border-gray-300 text-gray-600 rounded-lg font-medium"
                                                onClick={() => skipStop(stop.id)}
                                            >
                                                <SkipForward className="h-4 w-4 mr-2" /> Saltar
                                            </Button>
                                            <Button
                                                className="flex-1 h-10 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-medium"
                                                onClick={() => completeStop(stop.id)}
                                            >
                                                Completar
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    );
                })}

                {/* Delivery Destination - Compact & Clickable */}
                {request.mandadito_type === "shopping" && (
                    <button
                        onClick={() => setShowDeliveryMap(true)}
                        className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 shadow-sm active:bg-gray-50 transition-colors"
                    >
                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <Navigation className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">Entregar</p>
                            <p className="font-medium text-gray-900 text-sm truncate">{request.delivery_address}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </button>
                )}
            </div>

            {/* Delivery Location Mini Map Modal */}
            {showDeliveryMap && request.delivery_lat && request.delivery_lng && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
                        {/* Map Header */}
                        <div className="bg-blue-500 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-white" />
                                <span className="font-semibold text-white">Punto de entrega</span>
                            </div>
                            <button
                                onClick={() => setShowDeliveryMap(false)}
                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                            >
                                <X className="h-5 w-5 text-white" />
                            </button>
                        </div>

                        {/* Map Container - Simple marker only, no routes */}
                        <div className="h-56 relative">
                            <SimpleLocationMap
                                lat={request.delivery_lat}
                                lng={request.delivery_lng}
                                markerColor="#3b82f6"
                            />
                        </div>

                        {/* Info */}
                        <div className="p-4 border-t border-gray-100">
                            <p className="text-sm text-gray-800 font-medium">{request.delivery_address}</p>
                            {request.delivery_references && (
                                <p className="text-xs text-gray-500 mt-1">📍 {request.delivery_references}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Fixed Bottom Action - Only shows when ready */}
            {allStopsComplete && request.status === 'assigned' && (
                <div className="fixed bottom-16 left-0 right-0 p-5 bg-white border-t border-gray-200 shadow-lg">
                    <Button
                        className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
                        onClick={startDelivery}
                    >
                        <Navigation className="h-5 w-5 mr-2" />
                        Iniciar viaje al domicilio
                    </Button>
                </div>
            )
            }

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

            {/* Map Modal */}
            {/* Map Modal (Centered, Half Screen) */}
            <Dialog open={!!selectedMapStop} onOpenChange={(open) => {
                if (!open) {
                    setSelectedMapStop(null);
                    setIsNavigatingToStore(false);
                }
            }}>
                <DialogContent className="sm:max-w-lg w-[90%] p-0 overflow-hidden bg-white border-0 rounded-2xl">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Ubicación de Tienda</DialogTitle>
                        <DialogDescription>Mapa de ubicación de la tienda</DialogDescription>
                    </DialogHeader>

                    {/* Header */}
                    <div className="p-3 bg-[#10B981] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-white" />
                            <span className="font-semibold text-white text-sm">
                                {isNavigatingToStore ? 'Navegando' : 'Ubicación de Tienda'}
                            </span>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedMapStop(null);
                                setIsNavigatingToStore(false);
                            }}
                            className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                        >
                            <X className="h-4 w-4 text-white" />
                        </button>
                    </div>

                    {/* Map Area - Toggles between simple marker and navigation */}
                    <div className={`${isNavigatingToStore ? 'h-[50vh]' : 'h-56'} relative bg-gray-100 w-full transition-all`}>
                        {selectedMapStop?.lat && selectedMapStop?.lng ? (
                            isNavigatingToStore ? (
                                (() => {
                                    // Use driver location if available, otherwise use a fallback position near the store
                                    const startLocation = driverLocation?.lat && driverLocation?.lng
                                        ? { lat: driverLocation.lat, lng: driverLocation.lng }
                                        : { lat: selectedMapStop.lat - 0.005, lng: selectedMapStop.lng - 0.005 }; // ~500m away

                                    return (
                                        <DriverNavigationMap
                                            ref={mapRef}
                                            pickupLocation={startLocation}
                                            dropoffLocation={{ lat: selectedMapStop.lat, lng: selectedMapStop.lng }}
                                            driverLocation={driverLocation || { lat: startLocation.lat, lng: startLocation.lng }}
                                            className="w-full h-full"
                                            trackingStep="picked_up"
                                        />
                                    );
                                })()
                            ) : (
                                <SimpleLocationMap
                                    lat={selectedMapStop.lat}
                                    lng={selectedMapStop.lng}
                                    markerColor="#10B981"
                                />
                            )
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                Sin coordenadas
                            </div>
                        )}
                    </div>

                    {/* Store Info & Navigation Button */}
                    <div className="p-4 border-t border-gray-100">
                        <p className="text-sm text-gray-800 font-bold mb-2">{selectedMapStop?.address}</p>

                        {!isNavigatingToStore && selectedMapStop?.lat && selectedMapStop?.lng && (
                            <Button
                                className="w-full bg-[#10B981] hover:bg-[#059669] text-white h-11 rounded-xl font-bold flex items-center justify-center gap-2 mt-2"
                                onClick={() => {
                                    setIsNavigatingToStore(true);
                                    mapRef.current?.startNavigation();
                                    toast.success("Navegación iniciada");
                                }}
                            >
                                <NavigationIcon className="h-4 w-4" />
                                Ir a {selectedMapStop.address.split(',')[0]}
                            </Button>
                        )}
                    </div>
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
