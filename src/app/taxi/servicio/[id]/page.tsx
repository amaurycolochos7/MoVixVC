"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    MapPin,
    Phone,
    Navigation,
    User,
    X,
    CheckCircle,
    Loader2,
    AlertTriangle,
    Car,
    DollarSign,
    ArrowRight,
    ChevronUp,
    ChevronDown,
    Shield
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { DriverNavigationMap } from "@/components/maps/driver-navigation-map";
import { cn } from "@/lib/utils";

// Tracking steps configuration
const TRACKING_STEPS = [
    { id: "accepted", label: "Aceptado", actionLabel: "Iniciar viaje", icon: CheckCircle },
    { id: "on_the_way", label: "En camino", actionLabel: "Notificar llegada", icon: Car },
    { id: "nearby", label: "Cerca", actionLabel: "Notificar llegada", icon: MapPin }, // Auto-triggered usually
    { id: "arrived", label: "Llegó", actionLabel: "Pasajero a bordo", icon: MapPin },
    { id: "picked_up", label: "En viaje", actionLabel: "Llegar a destino", icon: User },
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
    origin_references: string;
    destination_address: string;
    destination_lat: number;
    destination_lng: number;
    created_at: string;
    estimated_price: number;
    final_price: number;
    client_id: string;
    notes: string;
    cancellation_reason: string | null;
}

interface Client {
    id: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
}

export default function DriverServicePage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const requestId = params.id as string;

    const [request, setRequest] = useState<ServiceRequest | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [updatingStep, setUpdatingStep] = useState(false);
    const [isSheetExpanded, setIsSheetExpanded] = useState(false);

    // Route metrics from map
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

    // Auto-expand sheet on arrive/pickup for actions
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
            setRequest(data);

            if (data.client_id) {
                const { data: clientData } = await supabase
                    .from("users")
                    .select("id, full_name, phone, avatar_url")
                    .eq("id", data.client_id)
                    .single();
                if (clientData) setClient(clientData);
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
            .channel(`service-${requestId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}`
            }, (payload) => {
                const updated = payload.new as ServiceRequest;
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
        const fare = request.final_price || request.estimated_price || 50;
        // Logic for payment...
        setCompleting(true);
        try {
            await supabase.from("service_requests").update({
                status: "completed", tracking_step: "completed", completed_at: new Date().toISOString()
            }).eq("id", requestId);
            router.push("/taxi");
        } catch (e) { toast.error("Error al finalizar"); } finally { setCompleting(false); }
    };

    const handleCancel = async () => {
        if (!selectedReason) return toast.error("Selecciona motivo");
        setCancelling(true);
        try {
            const reasonLabel = CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
            await supabase.from("service_requests").update({
                status: "cancelled", cancelled_at: new Date().toISOString(), cancellation_reason: `Cancelado por conductor: ${reasonLabel}`
            }).eq("id", requestId);
            router.push("/taxi");
        } catch (e) { toast.error("Error"); } finally { setCancelling(false); }
    };

    const openMapsNavigation = () => {
        const lat = currentStepIndex < 4 ? request?.origin_lat : request?.destination_lat;
        const lng = currentStepIndex < 4 ? request?.origin_lng : request?.destination_lng;
        if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin" /></div>;
    if (!request) return <div>No encontrado</div>;

    const isPickupPhase = currentStepIndex < 4;
    const destinationLabel = isPickupPhase ? "Recoger cliente" : "Ir al destino";
    const address = isPickupPhase ? request.origin_address : request.destination_address;

    return (
        <div className="relative h-[100dvh] w-full overflow-hidden bg-gray-100 flex flex-col">

            {/* 1. MAP BACKGROUND */}
            <div className="absolute inset-0 z-0">
                {request.origin_lat && request.origin_lng && (
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
                )}
            </div>

            {/* 2. TOP BAR (Minimal) */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-4 flex justify-center pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md shadow-sm border border-gray-100 rounded-full px-4 py-2 flex items-center gap-3 pointer-events-auto max-w-[90%]">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-semibold truncate max-w-[120px]">
                        {client?.full_name || "Cliente"}
                    </span>
                    <div className="h-4 w-px bg-gray-200" />
                    <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                        {TRACKING_STEPS[currentStepIndex]?.label}
                    </span>
                    <Button size="icon" variant="ghost" className="w-6 h-6 ml-1 rounded-full text-green-600 hover:bg-green-50" onClick={() => window.open(`tel:${client?.phone}`)}>
                        <Phone className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* 3. ERROR BANNER (Discrete) */}
            {gpsError && (
                <div className="absolute top-20 left-4 right-4 z-20 pointer-events-none">
                    <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg backdrop-blur text-center animate-in fade-in slide-in-from-top-2">
                        📡 Sin señal GPS. Reintentando...
                    </div>
                </div>
            )}


            {/* 4. BOTTOM SHEET (Uber Style) */}
            <div
                className={cn(
                    "absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl transition-all duration-300 ease-in-out flex flex-col",
                    isSheetExpanded ? "h-[380px]" : "h-[160px]" // Compact vs Expanded
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

                    {/* Metrics Row (Always Visible) */}
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-3xl font-bold tracking-tight text-gray-900">
                                {routeMetrics.eta} <span className="text-base font-medium text-gray-500">min</span>
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn("text-sm font-medium px-2 py-0.5 rounded-md", isPickupPhase ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                                    {routeMetrics.distance.toFixed(1)} km
                                </span>
                                <span className="text-gray-400 text-sm">•</span>
                                <span className="text-sm text-gray-500 truncate max-w-[150px]">
                                    {address}
                                </span>
                            </div>
                        </div>

                        {/* Navigation FAB */}
                        <Button
                            className="w-12 h-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 shrink-0 mb-1"
                            onClick={openMapsNavigation}
                        >
                            <Navigation className="w-5 h-5 text-white" />
                        </Button>
                    </div>

                    <div className="h-px bg-gray-100 w-full mb-4" />

                    {/* Expanded Content */}
                    <div className={cn("space-y-4 transition-opacity duration-300", isSheetExpanded ? "opacity-100" : "opacity-0 hidden")}>

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
                                Cobrar ${(request.final_price || request.estimated_price)}
                            </Button>
                        )}

                        {/* Secondary Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="h-12 border-gray-200 rounded-xl" onClick={() => setShowCancelModal(true)}>
                                <X className="w-4 h-4 mr-2" /> Cancelar
                            </Button>
                            <Button variant="outline" className="h-12 border-gray-200 rounded-xl" onClick={() => { }}>
                                <Shield className="w-4 h-4 mr-2" /> Ayuda
                            </Button>
                        </div>

                        {/* Fare Info */}
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                            <span className="text-sm font-medium text-gray-500">Tarifa estimada</span>
                            <span className="text-lg font-bold">${request.estimated_price}</span>
                        </div>
                    </div>

                    {/* Compact Hint (Only when collision) */}
                    {!isSheetExpanded && (
                        <div className="text-center">
                            <Button variant="ghost" size="sm" className="text-gray-400 font-normal w-full" onClick={() => setIsSheetExpanded(true)}>
                                Ver detalles y acciones <ChevronUp className="ml-1 w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals (Payment / Cancel) logic maintained... */}
            {/* Same Payment Modal code... */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm p-6 space-y-6 shadow-2xl skew-y-0 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <DollarSign className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold">Cobrar Viaje</h3>
                            <p className="text-gray-500">Cliente: {client?.full_name}</p>
                        </div>
                        <div className="py-4 border-y border-dashed border-gray-200">
                            <p className="text-sm text-gray-400 uppercase tracking-widest font-bold">Total a pagar</p>
                            <p className="text-5xl font-black text-gray-900 tracking-tighter mt-1">${request.estimated_price}</p>
                        </div>

                        <div className="space-y-3">
                            <Input
                                type="number"
                                placeholder="Monto recibido"
                                className="h-14 text-center text-xl font-bold bg-gray-50 border-transparent focus:bg-white transition-all ring-offset-2"
                                value={amountReceived}
                                onChange={e => setAmountReceived(e.target.value)}
                            />
                            {parseFloat(amountReceived) >= request.estimated_price && (
                                <div className="p-3 bg-green-50 text-green-800 rounded-lg font-bold">
                                    Cambio: ${(parseFloat(amountReceived) - request.estimated_price).toFixed(2)}
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
            {/* Same Cancel Modal code... */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm p-5 space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <h3 className="text-lg font-bold">Cancelar Servicio</h3>
                        </div>
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

        </div>
    );
}
