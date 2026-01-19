"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Radar } from "@/components/radar/radar";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import {
    Bike, TrendingUp, Clock, DollarSign,
    MapPin, Zap, Star, ChevronRight, Package,
    ShieldCheck, Loader2, AlertCircle, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CommissionBlockedScreen } from "@/components/driver/commission-blocked-screen";

export default function MandaditoHomePage() {
    const [isAvailable, setIsAvailable] = useState(false);
    const [driverName, setDriverName] = useState("");
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const [commissionBlocked, setCommissionBlocked] = useState(false);
    const [amountOwed, setAmountOwed] = useState(0);
    const [loading, setLoading] = useState(true);
    const [todayStats, setTodayStats] = useState({
        trips: 0,
        earnings: 0,
        hours: 0,
    });
    const { activeTrip } = useActiveTrip("driver");
    const supabase = createClient();
    const router = useRouter();

    // Fetch driver info and KYC status
    useEffect(() => {
        const fetchDriver = async () => {
            setLoading(true);
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                const { data } = await supabase
                    .from("users")
                    .select("full_name, kyc_status, is_available, commission_status")
                    .eq("id", user.id)
                    .single();

                if (data) {
                    setDriverName(data.full_name?.split(" ")[0] || "Conductor");
                    setKycStatus(data.kyc_status);
                    setIsAvailable(data.is_available ?? false);

                    // Check if commission blocked
                    if (data.commission_status === 'blocked') {
                        setCommissionBlocked(true);

                        // Calculate owed amount from unpaid periods
                        const { data: overdueServices } = await supabase
                            .from("service_requests")
                            .select("id")
                            .eq("assigned_driver_id", user.id)
                            .eq("service_type", "mandadito")
                            .eq("status", "completed");

                        const { data: paidPeriods } = await supabase
                            .from("driver_commission_periods")
                            .select("completed_services")
                            .eq("driver_id", user.id)
                            .eq("service_type", "mandadito")
                            .eq("status", "paid");

                        const totalServices = overdueServices?.length || 0;
                        const paidServices = paidPeriods?.reduce((sum, p) => sum + (p.completed_services || 0), 0) || 0;
                        const unpaidServices = totalServices - paidServices;
                        setAmountOwed(unpaidServices * 3); // $3 per mandadito
                    }
                }

                // Fetch today's stats
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const { data: trips } = await supabase
                    .from("service_requests")
                    .select("final_price")
                    .eq("assigned_driver_id", user.id)
                    .eq("status", "completed")
                    .eq("service_type", "mandadito")
                    .gte("completed_at", today.toISOString());

                if (trips) {
                    setTodayStats({
                        trips: trips.length,
                        earnings: trips.reduce((acc, t) => acc + (t.final_price || 0), 0),
                        hours: Math.round((trips.length * 25) / 60),
                    });
                }
            }
            setLoading(false);
        };
        fetchDriver();
    }, [supabase]);

    // Sync local state with database on mount
    useEffect(() => {
        const syncAvailability = async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                const { data } = await supabase
                    .from("users")
                    .select("is_available")
                    .eq("id", user.id)
                    .single();

                if (data) {
                    setIsAvailable(data.is_available ?? false);
                }
            }
        };
        syncAvailability();
    }, []);

    // AUTO-REDIRECT: If driver has active service, redirect to service page
    useEffect(() => {
        let userId: string | null = null;
        let pollInterval: NodeJS.Timeout | null = null;

        const checkActiveService = async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return;
            userId = user.id; // Cache user ID for realtime callbacks

            // Check if driver has an active assigned service
            const { data: activeService } = await supabase
                .from("service_requests")
                .select("id, status, service_type")
                .eq("assigned_driver_id", user.id)
                .eq("service_type", "mandadito")
                .in("status", ["assigned", "in_progress"])
                .maybeSingle();

            if (activeService) {
                console.log("🚀 Auto-redirecting to active service:", activeService.id, activeService);
                router.push(`/mandadito/servicio/${activeService.id}`);
            } else {
                console.log("ℹ️ No active service found for driver");
            }
        };

        checkActiveService();

        // ⚡ FAST POLLING: Check every 2 seconds for new assignments (much faster than waiting for realtime)
        pollInterval = setInterval(async () => {
            if (!userId) {
                const user = (await supabase.auth.getUser()).data.user;
                userId = user?.id || null;
            }
            if (!userId) return;

            const { data: activeService } = await supabase
                .from("service_requests")
                .select("id, status")
                .eq("assigned_driver_id", userId)
                .eq("service_type", "mandadito")
                .in("status", ["assigned", "in_progress"])
                .maybeSingle();

            if (activeService) {
                console.log("⚡ POLLING: Found active service, redirecting:", activeService.id);
                router.push(`/mandadito/servicio/${activeService.id}`);
            }
        }, 2000); // Check every 2 seconds

        // Also subscribe to realtime changes for assignments (backup)
        const channel = supabase
            .channel('mandadito-assignment')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'service_requests',
                filter: `service_type=eq.mandadito`
            }, (payload) => {
                const newData = payload.new as any;

                // Use cached userId instead of async call for faster response
                console.log("🔔 Assignment check:", {
                    requestId: newData.id,
                    assigned_to: newData.assigned_driver_id,
                    my_id: userId,
                    status: newData.status,
                    match: newData.assigned_driver_id === userId && newData.status === 'assigned'
                });

                // If this request was just assigned to me
                if (userId && newData.assigned_driver_id === userId && newData.status === 'assigned') {
                    console.log("🎯 Client accepted my offer! Redirecting to service...");
                    router.push(`/mandadito/servicio/${newData.id}`);
                }
            })
            .subscribe();

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, []);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    // Commission Blocked Screen
    if (commissionBlocked) {
        return <CommissionBlockedScreen amountOwed={amountOwed} />;
    }

    // KYC Pending / Not Approved Screen
    if (kycStatus !== "approved") {
        return (
            <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                    {kycStatus === "pending" ? (
                        <Loader2 className="h-12 w-12 text-orange-500 animate-spin" />
                    ) : kycStatus === "rejected" ? (
                        <AlertCircle className="h-12 w-12 text-red-500" />
                    ) : (
                        <ShieldCheck className="h-12 w-12 text-orange-500" />
                    )}
                </div>

                <h1 className="text-2xl font-bold text-slate-900 mb-2">
                    {kycStatus === "pending"
                        ? "Verificación en proceso"
                        : kycStatus === "rejected"
                            ? "Verificación rechazada"
                            : "Verificación requerida"}
                </h1>

                <p className="text-slate-500 mb-6 max-w-sm">
                    {kycStatus === "pending"
                        ? "Tu cuenta está siendo revisada por un administrador. Te notificaremos cuando esté aprobada."
                        : kycStatus === "rejected"
                            ? "Tu solicitud fue rechazada. Por favor contacta al soporte para más información."
                            : "Para empezar a recibir mandados, necesitas subir tus documentos de verificación."}
                </p>

                {kycStatus === "not_submitted" && (
                    <Link href="/mandadito/perfil">
                        <Button className="bg-orange-500 hover:bg-orange-600">
                            <FileText className="h-4 w-4 mr-2" />
                            Subir Documentos
                        </Button>
                    </Link>
                )}

                {kycStatus === "pending" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-sm">
                        <p className="text-amber-800 text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Tiempo de revisión: 24-48 horas
                        </p>
                    </div>
                )}

                {kycStatus === "rejected" && (
                    <Link href="/mandadito/perfil">
                        <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                            Ver razón del rechazo
                        </Button>
                    </Link>
                )}
            </div>
        );
    }

    // Toggle availability in DB
    const handleAvailabilityChange = async (available: boolean) => {
        setIsAvailable(available);
        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
            await supabase
                .from("users")
                .update({ is_available: available })
                .eq("id", user.id);
        }
    };

    if (activeTrip) {
        return (
            <div className="h-[calc(100vh-6rem)] flex flex-col relative">
                <ServiceTracking requestId={activeTrip.id} userRole="driver" initialRequestData={activeTrip} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] bg-gray-100 flex flex-col overflow-hidden">
            {/* Header - Compact */}
            <div className="flex-shrink-0 bg-gradient-to-b from-orange-500 to-orange-600 text-white px-5 pt-6 pb-10">
                <p className="text-orange-200 text-xs mb-0.5">Hola, {driverName || "Conductor"}</p>
                <h1 className="text-xl font-bold">Panel de conductor</h1>
            </div>

            {/* Availability Card - Compact */}
            <div className="flex-shrink-0 px-5 -mt-5 relative z-10 mb-3">
                <Card className="p-4 bg-white shadow-lg border-0 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAvailable ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-900">
                                    {isAvailable ? "En línea" : "Desconectado"}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {isAvailable ? "Recibiendo solicitudes" : "Toca para conectarte"}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={isAvailable}
                            onCheckedChange={handleAvailabilityChange}
                            className="data-[state=checked]:bg-orange-500"
                        />
                    </div>
                </Card>
            </div>

            {/* Stats Cards - Compact */}
            <div className="flex-shrink-0 px-5 mb-3">
                <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3 bg-white shadow-sm border-0 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
                            <Package className="h-4 w-4 text-orange-500" />
                        </div>
                        <p className="text-xl font-bold text-gray-900 text-center">{todayStats.trips}</p>
                        <p className="text-[10px] text-gray-500 text-center">Entregas</p>
                    </Card>
                    <Card className="p-3 bg-white shadow-sm border-0 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-xl font-bold text-gray-900 text-center">${todayStats.earnings}</p>
                        <p className="text-[10px] text-gray-500 text-center">Ganado</p>
                    </Card>
                    <Card className="p-3 bg-white shadow-sm border-0 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                            <Clock className="h-4 w-4 text-blue-500" />
                        </div>
                        <p className="text-xl font-bold text-gray-900 text-center">{todayStats.hours}h</p>
                        <p className="text-[10px] text-gray-500 text-center">Activo</p>
                    </Card>
                </div>
            </div>

            {/* Scrollable Request List - Takes remaining space */}
            <div className="flex-1 overflow-y-auto px-5 pb-20 min-h-0">
                {!isAvailable ? (
                    <Card className="p-6 bg-white shadow-sm border-0 rounded-2xl text-center">
                        <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                            <Zap className="h-8 w-8 text-orange-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Activa tu disponibilidad
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Hay mandados esperando cerca de ti. Conecta para empezar a recibir solicitudes.
                        </p>
                    </Card>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                            <p className="font-semibold text-gray-900 text-sm">Mandados cerca de ti</p>
                        </div>
                        <Radar serviceType="mandadito" isAvailable={isAvailable} />
                    </>
                )}
            </div>
        </div>
    );
}
