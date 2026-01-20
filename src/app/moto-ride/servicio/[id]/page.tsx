"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    MapPin, Phone, Navigation, User, X, CheckCircle, Loader2, AlertTriangle,
    Bike, DollarSign, ChevronUp, Shield, MessageCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { DriverNavigationMap } from "@/components/maps/driver-navigation-map";
import { BoardingPinModal } from "@/components/driver/boarding-pin-modal";
import { cn } from "@/lib/utils";

// Tracking steps for Moto Ride (simplified like taxi)
const TRACKING_STEPS = [
    { id: "accepted", label: "Aceptado", actionLabel: "Salir hacia el cliente", icon: CheckCircle },
    { id: "on_the_way", label: "En camino", actionLabel: "Ya llegué al cliente", icon: Bike },
    { id: "nearby", label: "Cerca", actionLabel: "Confirmar llegada", icon: MapPin },
    { id: "arrived", label: "Llegó", actionLabel: "Cliente a bordo", icon: MapPin },
    { id: "picked_up", label: "En viaje", actionLabel: "Llegando al destino", icon: User },
    { id: "in_transit", label: "Llegando", actionLabel: "Finalizar viaje", icon: Navigation },
];

const CANCELLATION_REASONS = [
    { id: "out_of_route", label: "Fuera de mi ruta" },
    { id: "client_no_response", label: "Cliente no responde" },
    { id: "vehicle_issue", label: "Problema con el vehículo" },
    { id: "emergency", label: "Emergencia personal" },
    { id: "other", label: "Otro motivo" },
];

interface ServiceRequest {
    id: string;
    status: string;
    tracking_step: string;
    service_type: string;
    origin_address: string;
    origin_lat: number;
    origin_lng: number;
    destination_address: string;
    destination_lat: number;
    destination_lng: number;
    created_at: string;
    estimated_price: number;
    final_price: number;
    client_id: string;
    notes: string;
    cancellation_reason: string | null;
    assigned_at?: string;
}

interface Client {
    id: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
}

interface Vehicle {
    brand: string;
    model: string;
    color: string;
    plate_number: string | null;
}

export default function MotoRideServicePage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const requestId = params.id as string;

    const [request, setRequest] = useState<ServiceRequest | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [updatingStep, setUpdatingStep] = useState(false);
    const [isSheetExpanded, setIsSheetExpanded] = useState(false);

    // Route metrics
    const [routeMetrics, setRouteMetrics] = useState({ eta: 0, distance: 0, isOffRoute: false });

    // Payment state
    const [amountReceived, setAmountReceived] = useState("");
    const [completing, setCompleting] = useState(false);

    // GPS Broadcast
    const { currentPosition, gpsError } = useDriverLocation({
        enabled: true,
        intervalMs: 3000,
        serviceId: requestId
    });

    // Calculate if can cancel (only before picked_up and within 3 minutes)
    const canCancel = useMemo(() => {
        if (!request) return false;
        // Cannot cancel if already in_progress (picked_up or later)
        if (request.status === 'in_progress') return false;
        // Check 3-minute restriction
        const startTime = new Date(request.assigned_at || request.created_at).getTime();
        const now = Date.now();
        const minutesElapsed = (now - startTime) / 1000 / 60;
        return minutesElapsed <= 3;
    }, [request]);

    // Auto-expand sheet on arrive/pickup
    useEffect(() => {
        if (request?.tracking_step === 'arrived' || request?.tracking_step === 'picked_up') {
            setIsSheetExpanded(true);
        } else {
            setIsSheetExpanded(false);
        }
    }, [request?.tracking_step]);

    const fetchRequest = async () => {
        try {
            const { data, error } = await supabase
                .from("service_requests")
                .select("*")
                .eq("id", requestId)
                .single();

            if (error) throw error;

            if (data.status === 'cancelled') {
                toast.error("Este servicio está cancelado");
                router.push("/mandadito");
                return;
            }

            setRequest(data);

            if (data.client_id) {
                const { data: clientData } = await supabase
                    .from("users")
                    .select("id, full_name, phone, avatar_url")
                    .eq("id", data.client_id)
                    .single();
                if (clientData) setClient(clientData);
            }

            // Fetch driver's vehicle info
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                const { data: vehicleData } = await supabase
                    .from("driver_vehicles")
                    .select("brand, model, color, plate_number")
                    .eq("user_id", user.id)
                    .single();
                if (vehicleData) setVehicle(vehicleData);
            }
        } catch (err: any) {
            console.error("Error fetching request:", err);
            toast.error("Error al cargar el servicio");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequest();
        const channel = supabase
            .channel(`motoride-service-${requestId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}`
            }, (payload) => {
                const updated = payload.new as ServiceRequest;
                if (updated.status === 'cancelled') {
                    toast.error("Este servicio ha sido cancelado");
                    router.push("/mandadito");
                    return;
                }
                setRequest(updated);
            })
            .subscribe();

        const pollInterval = setInterval(fetchRequest, 5000);
        return () => {
            clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [requestId]);

    // Step Logic
    const getCurrentStepIndex = () => {
        if (!request?.tracking_step) return 0;
        const idx = TRACKING_STEPS.findIndex(s => s.id === request.tracking_step);
        return idx >= 0 ? idx : 0;
    };
    const currentStepIndex = getCurrentStepIndex();
    const isLastStep = currentStepIndex === TRACKING_STEPS.length - 1;
    const nextStep = !isLastStep ? TRACKING_STEPS[currentStepIndex + 1] : null;

    const handleNextStep = async () => {
        if (!nextStep || !request) return;
        setUpdatingStep(true);
        try {
            const updates: any = { tracking_step: nextStep.id };
            if (nextStep.id === "picked_up") {
                updates.status = "in_progress";
                updates.started_at = new Date().toISOString();
            }
            await supabase.from("service_requests").update(updates).eq("id", requestId);
            toast.success(nextStep.label);
            fetchRequest();
        } catch (err) {
            toast.error("Error al actualizar");
        } finally {
            setUpdatingStep(false);
        }
    };

    const handleCompleteTrip = async () => {
        if (!request) return;
        setCompleting(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;

            await supabase.from("service_requests").update({
                status: "completed",
                tracking_step: "completed",
                completed_at: new Date().toISOString()
            }).eq("id", requestId);

            // Keep driver available
            if (user) {
                await supabase.from("users").update({ is_available: true }).eq("id", user.id);
            }

            toast.success("¡Viaje completado! 🎉");
            router.push("/mandadito");
        } catch (e) {
            toast.error("Error al finalizar");
        } finally {
            setCompleting(false);
        }
    };

    const handleCancel = async () => {
        if (!selectedReason) return toast.error("Selecciona motivo");
        setCancelling(true);
        try {
            const reasonLabel = CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;

            const { data, error } = await supabase.rpc('cancel_service_by_driver', {
                p_request_id: requestId,
                p_reason: `Cancelado por conductor: ${reasonLabel}`
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || "Error desconocido");

            toast.success("Viaje cancelado exitosamente");
            router.push("/mandadito");
        } catch (e: any) {
            console.error("Cancellation error:", e);
            toast.error("Error al cancelar: " + (e.message || "Desconocido"));
        } finally {
            setCancelling(false);
        }
    };

    const handleValidatePin = async (pin: string): Promise<boolean> => {
        try {
            console.log("🔐 Validating boarding PIN:", pin);

            const { data, error } = await supabase.rpc('validate_boarding_pin', {
                p_request_id: requestId,
                p_pin: pin
            });

            if (error) {
                console.error("❌ PIN validation error:", error);
                toast.error("Error al validar código");
                return false;
            }

            if (!data.success) {
                console.log("❌ Invalid PIN:", data.message);
                toast.error(data.message || "Código incorrecto");
                return false;
            }

            console.log("✅ PIN validated successfully!");
            toast.success("¡Viaje iniciado! 🏍️");
            setShowPinModal(false);
            fetchRequest();
            return true;
        } catch (err: any) {
            console.error("❌ Error validating PIN:", err);
            toast.error("Error al validar código");
            return false;
        }
    };

    const openMapsNavigation = () => {
        const lat = currentStepIndex < 4 ? request?.origin_lat : request?.destination_lat;
        const lng = currentStepIndex < 4 ? request?.origin_lng : request?.destination_lng;
        if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-orange-500" /></div>;
    if (!request) return <div>No encontrado</div>;

    const isPickupPhase = currentStepIndex < 4;
    const address = isPickupPhase ? request.origin_address : request.destination_address;
    const fare = request.final_price || request.estimated_price || 20;

    return (
        <div className="relative h-[100dvh] w-full overflow-hidden bg-gray-100 flex flex-col">

            {/* 1. MAP BACKGROUND */}
            <div className="absolute inset-0 z-0 pointer-events-auto">
                <DriverNavigationMap
                    pickupLocation={{ lat: request.origin_lat, lng: request.origin_lng }}
                    dropoffLocation={
                        request.destination_lat && request.destination_lng
                            ? { lat: request.destination_lat, lng: request.destination_lng }
                            : undefined
                    }
                    driverLocation={currentPosition || undefined}
                    trackingStep={request.tracking_step}
                    className="w-full h-full"
                    onRouteMetricsChange={setRouteMetrics}
                />
            </div>

            {/* 2. TOP BAR - Moto Ride Style (Orange) */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-4 flex flex-col items-center gap-2 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md shadow-sm border border-gray-100 rounded-full px-4 py-2 flex items-center gap-3 pointer-events-auto max-w-[90%]">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-sm font-semibold truncate max-w-[120px]">
                        {client?.full_name || "Cliente"}
                    </span>
                    <div className="h-4 w-px bg-gray-200" />
                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                        {TRACKING_STEPS[currentStepIndex]?.label}
                    </span>

                    {/* WhatsApp Button */}
                    <Button
                        size="icon"
                        variant="ghost"
                        className="w-6 h-6 rounded-full text-[#25D366] hover:bg-green-50"
                        onClick={() => {
                            if (client?.phone) {
                                const phone = client.phone.replace(/\D/g, '');
                                window.open(`https://wa.me/52${phone}`, '_blank');
                            }
                        }}
                    >
                        <MessageCircle className="w-3.5 h-3.5" />
                    </Button>

                    {/* Call Button */}
                    <Button
                        size="icon"
                        variant="ghost"
                        className="w-6 h-6 rounded-full text-blue-500 hover:bg-blue-50"
                        onClick={() => window.open(`tel:${client?.phone}`)}
                    >
                        <Phone className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Phase Indicator Badge */}
                <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold shadow-md border-2 transition-all pointer-events-none",
                    isPickupPhase
                        ? "bg-orange-500 text-white border-orange-300"
                        : "bg-green-500 text-white border-green-300"
                )}>
                    {isPickupPhase ? "🟠 Recoger cliente" : "🟢 Ir al destino"}
                </div>
            </div>

            {/* 3. GPS ERROR BANNER */}
            {gpsError && (
                <div className="absolute top-20 left-4 right-4 z-20 pointer-events-none">
                    <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg backdrop-blur text-center animate-in fade-in slide-in-from-top-2">
                        📡 Sin señal GPS. Reintentando...
                    </div>
                </div>
            )}

            {/* 4. BOTTOM SHEET */}
            <div
                className={cn(
                    "absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 ease-in-out flex flex-col",
                    isSheetExpanded ? "h-[380px]" : "h-[160px]"
                )}
            >
                {/* Drag Handle */}
                <div
                    className="w-full h-6 flex items-center justify-center cursor-pointer shrink-0"
                    onClick={() => setIsSheetExpanded(!isSheetExpanded)}
                >
                    <div className="w-12 h-1.5 rounded-full bg-gray-200" />
                </div>

                <div className="flex-1 px-5 pb-5 overflow-y-auto">

                    {/* Metrics Row */}
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-3xl font-bold tracking-tight text-gray-900">
                                {routeMetrics.eta} <span className="text-base font-medium text-gray-500">min</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn("text-sm font-medium px-2 py-0.5 rounded-md", isPickupPhase ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")}>
                                    {routeMetrics.distance.toFixed(1)} km
                                </span>
                                <span className="text-gray-400 text-sm">•</span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                                    {isPickupPhase ? "→ Cliente" : "→ Destino"}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate max-w-[220px] mt-1">
                                {address}
                            </p>
                        </div>

                        {/* Navigation FAB */}
                        <Button
                            className="w-12 h-12 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 shrink-0 mb-1"
                            onClick={openMapsNavigation}
                        >
                            <Navigation className="w-5 h-5 text-white" />
                        </Button>
                    </div>

                    <div className="h-px bg-gray-100 w-full mb-4" />

                    {/* Expanded Content */}
                    <div className={cn("space-y-4 transition-opacity duration-300", isSheetExpanded ? "opacity-100" : "opacity-0 hidden")}>

                        {/* INICIAR VIAJE CON PIN - Before in_progress */}
                        {request.status !== 'in_progress' && request.status !== 'completed' && (
                            <Button
                                className="w-full h-16 text-lg font-bold shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl border-2 border-orange-400/30"
                                onClick={() => setShowPinModal(true)}
                            >
                                <Shield className="w-6 h-6 mr-3" />
                                INICIAR VIAJE CON CLIENTE
                            </Button>
                        )}

                        {/* Action Primary Button */}
                        {!isLastStep ? (
                            <Button
                                className="w-full h-14 text-lg font-bold shadow-md bg-black text-white hover:bg-gray-800 rounded-xl"
                                onClick={handleNextStep}
                                disabled={updatingStep}
                            >
                                {updatingStep ? <Loader2 className="mr-2 animate-spin" /> : null}
                                {nextStep?.actionLabel || "Continuar"}
                            </Button>
                        ) : (
                            <Button
                                className="w-full h-14 text-lg font-bold shadow-md bg-green-600 hover:bg-green-700 rounded-xl"
                                onClick={() => setShowPaymentModal(true)}
                            >
                                Cobrar ${fare}
                            </Button>
                        )}

                        {/* Secondary Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-12 rounded-xl",
                                    canCancel ? "border-gray-200" : "border-gray-100 opacity-50 cursor-not-allowed"
                                )}
                                onClick={() => canCancel && setShowCancelModal(true)}
                                disabled={!canCancel}
                            >
                                <X className="w-4 h-4 mr-2" />
                                {canCancel ? "Cancelar" : "No cancelable"}
                            </Button>
                            <Button variant="outline" className="h-12 border-gray-200 rounded-xl">
                                <Shield className="w-4 h-4 mr-2" /> Ayuda
                            </Button>
                        </div>

                        {/* Fare Info */}
                        <div className="flex justify-between items-center bg-orange-50 p-3 rounded-lg">
                            <span className="text-sm font-medium text-gray-500">Tarifa del servicio</span>
                            <span className="text-lg font-bold text-orange-600">${fare}</span>
                        </div>
                    </div>

                    {/* Compact Hint */}
                    {!isSheetExpanded && (
                        <div className="text-center">
                            <Button variant="ghost" size="sm" className="text-gray-400 font-normal w-full" onClick={() => setIsSheetExpanded(true)}>
                                Ver detalles y acciones <ChevronUp className="ml-1 w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm p-6 space-y-6 shadow-2xl text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <DollarSign className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold">Cobrar Viaje</h3>
                            <p className="text-gray-500">Cliente: {client?.full_name}</p>
                        </div>
                        <div className="py-4 border-y border-dashed border-gray-200">
                            <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Total a pagar</p>
                            <p className="text-5xl font-black text-gray-900 tracking-tighter mt-1">${fare}</p>
                        </div>

                        <div className="space-y-3">
                            <Input
                                type="number"
                                placeholder="Monto recibido"
                                className="h-14 text-center text-xl font-bold bg-gray-50 border-transparent focus:bg-white transition-all"
                                value={amountReceived}
                                onChange={e => setAmountReceived(e.target.value)}
                            />
                            {parseFloat(amountReceived) >= fare && (
                                <div className="p-3 bg-green-50 text-green-800 rounded-lg font-bold">
                                    Cambio: ${(parseFloat(amountReceived) - fare).toFixed(2)}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="h-12" onClick={() => setShowPaymentModal(false)}>Cancelar</Button>
                            <Button className="h-12 bg-green-600 hover:bg-green-700 font-bold" onClick={handleCompleteTrip} disabled={completing}>
                                {completing ? <Loader2 className="animate-spin" /> : "Confirmar Pago"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm p-5 space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold">Cancelar Servicio</h3>
                        </div>
                        <p className="text-sm text-gray-500">Selecciona el motivo de la cancelación:</p>
                        <div className="space-y-2">
                            {CANCELLATION_REASONS.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setSelectedReason(r.id)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border transition-all text-sm font-medium",
                                        selectedReason === r.id ? "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500" : "border-gray-200 hover:bg-gray-50"
                                    )}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setShowCancelModal(false)}>Volver</Button>
                            <Button className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700" disabled={!selectedReason || cancelling} onClick={handleCancel}>
                                {cancelling ? <Loader2 className="animate-spin" /> : "Cancelar Viaje"}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Boarding PIN Modal */}
            <BoardingPinModal
                open={showPinModal}
                onClose={() => setShowPinModal(false)}
                onValidate={handleValidatePin}
            />

        </div>
    );
}
