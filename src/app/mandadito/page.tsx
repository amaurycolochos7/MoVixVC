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

export default function MandaditoHomePage() {
    const [isAvailable, setIsAvailable] = useState(false);
    const [driverName, setDriverName] = useState("");
    const [kycStatus, setKycStatus] = useState<string | null>(null);
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
                    .select("full_name, kyc_status, is_available")
                    .eq("id", user.id)
                    .single();

                if (data) {
                    setDriverName(data.full_name.split(" ")[0]);
                    setKycStatus(data.kyc_status);
                    setIsAvailable(data.is_available ?? false);
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
        const checkActiveService = async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return;

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

        // Also subscribe to realtime changes for assignments
        const channel = supabase
            .channel('mandadito-assignment')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'service_requests',
                filter: `service_type=eq.mandadito`
            }, async (payload) => {
                const newData = payload.new as any;
                const user = (await supabase.auth.getUser()).data.user;

                console.log("🔔 Assignment check:", {
                    requestId: newData.id,
                    assigned_to: newData.assigned_driver_id,
                    my_id: user?.id,
                    status: newData.status,
                    match: newData.assigned_driver_id === user?.id && newData.status === 'assigned'
                });

                // If this request was just assigned to me
                if (newData.assigned_driver_id === user?.id && newData.status === 'assigned') {
                    console.log("🎯 Client accepted my offer! Redirecting to service...");
                    router.push(`/mandadito/servicio/${newData.id}`);
                }
            })
            .subscribe();

        return () => {
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
        <div className="min-h-[calc(100vh-6rem)] bg-gray-50 flex flex-col">
            {/* Compact Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 pt-5 pb-8">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <Bike className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <p className="text-orange-100 text-xs">¡Hola!</p>
                            <h1 className="text-lg font-bold">{driverName || "mandadito"}</h1>
                        </div>
                    </div>
                </div>

                {/* Availability Toggle - Compact */}
                <div className="bg-white/10 backdrop-blur rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`} />
                        <div>
                            <p className="font-semibold text-white text-sm">
                                {isAvailable ? "En línea" : "Desconectado"}
                            </p>
                            <p className="text-xs text-orange-100">
                                {isAvailable ? "Recibiendo solicitudes" : "Toca para conectarte"}
                            </p>
                        </div>
                    </div>
                    <Switch
                        checked={isAvailable}
                        onCheckedChange={handleAvailabilityChange}
                        className="data-[state=checked]:bg-green-500"
                    />
                </div>
            </div>

            {/* Compact Stats Cards */}
            <div className="px-4 -mt-4 relative z-20 mb-3">
                <div className="grid grid-cols-3 gap-2">
                    <Card className="p-2 text-center bg-white shadow-md border-0">
                        <Package className="h-4 w-4 text-orange-500 mx-auto mb-0.5" />
                        <p className="text-lg font-bold text-slate-900">{todayStats.trips}</p>
                        <p className="text-[10px] text-slate-500">Entregas hoy</p>
                    </Card>
                    <Card className="p-2 text-center bg-white shadow-md border-0">
                        <DollarSign className="h-4 w-4 text-green-500 mx-auto mb-0.5" />
                        <p className="text-lg font-bold text-slate-900">${todayStats.earnings}</p>
                        <p className="text-[10px] text-slate-500">Ganado hoy</p>
                    </Card>
                    <Card className="p-2 text-center bg-white shadow-md border-0">
                        <Clock className="h-4 w-4 text-blue-500 mx-auto mb-0.5" />
                        <p className="text-lg font-bold text-slate-900">{todayStats.hours}h</p>
                        <p className="text-[10px] text-slate-500">Tiempo activo</p>
                    </Card>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 px-4">
                {!isAvailable ? (
                    /* Offline State - Motivation */
                    <div className="text-center py-8">
                        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                            <Zap className="h-10 w-10 text-orange-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">
                            ¡Actívate y gana!
                        </h2>
                        <p className="text-slate-500 mb-6 max-w-xs mx-auto">
                            Hay mandados esperando cerca de ti. Conecta para empezar a recibir solicitudes.
                        </p>

                        {/* Quick Tips */}
                        <div className="space-y-3 text-left">
                            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-orange-500">
                                <TrendingUp className="h-5 w-5 text-orange-500 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Horas pico</p>
                                    <p className="text-xs text-slate-500">Mayor demanda de 12pm-3pm y 6pm-9pm</p>
                                </div>
                            </Card>
                            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-green-500">
                                <Star className="h-5 w-5 text-green-500 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Mejor servicio</p>
                                    <p className="text-xs text-slate-500">Buenos ratings = más solicitudes</p>
                                </div>
                            </Card>
                            <Card className="p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
                                <MapPin className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Zonas activas</p>
                                    <p className="text-xs text-slate-500">Centro y mercados tienen más pedidos</p>
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : (
                    /* Online State - Radar */
                    <div className="h-[calc(100vh-26rem)]">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Mandados cerca de ti
                            </h2>
                            <span className="text-xs text-slate-500">Actualización automática</span>
                        </div>
                        <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-200 h-full">
                            <Radar serviceType="mandadito" isAvailable={isAvailable} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
