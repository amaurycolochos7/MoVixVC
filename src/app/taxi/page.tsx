"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Radar } from "@/components/radar/radar";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { useAuth } from "@/contexts/auth-context";
import { AccountPendingMessage } from "@/components/driver/account-pending";
import { createClient } from "@/lib/supabase/client";
import { Car, DollarSign, Clock, Loader2, Zap, Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Link from "next/link";

interface DailyStats {
    trips: number;
    earnings: number;
}

export default function TaxiHomePage() {
    const { profile, refreshProfile } = useAuth();
    const [isAvailable, setIsAvailable] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { activeTrip } = useActiveTrip("driver");
    const supabase = createClient();

    // Real daily stats
    const [dailyStats, setDailyStats] = useState<DailyStats>({ trips: 0, earnings: 0 });

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch real daily stats
    useEffect(() => {
        const fetchDailyStats = async () => {
            if (!profile?.id) return;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from("service_requests")
                .select("final_price")
                .eq("assigned_driver_id", profile.id)
                .eq("service_type", "taxi")
                .eq("status", "completed")
                .gte("completed_at", today.toISOString());

            if (!error && data) {
                const earnings = data.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const commission = data.length * 5; // $5 per trip
                setDailyStats({
                    trips: data.length,
                    earnings: earnings - commission // Net after $5/trip commission
                });
            }
        };

        fetchDailyStats();
    }, [profile?.id, supabase]);

    // Sync local state with profile
    useEffect(() => {
        if (profile) {
            setIsAvailable(profile.is_available ?? false);
        }
    }, [profile]);

    // Refresh profile on mount
    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    const handleAvailabilityChange = async (checked: boolean) => {
        if (!profile || isUpdating) return;

        setIsUpdating(true);
        setIsAvailable(checked);

        try {
            const { error } = await supabase
                .from("users")
                .update({ is_available: checked })
                .eq("id", profile.id);

            if (error) {
                toast.error("Error al actualizar disponibilidad");
                setIsAvailable(!checked);
            } else {
                toast.success(checked ? "¡Estás en línea!" : "Desconectado");
                refreshProfile();
            }
        } catch (err) {
            setIsAvailable(!checked);
        } finally {
            setIsUpdating(false);
        }
    };

    // Don't render until mounted to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Check if driver is approved
    if (profile && profile.kyc_status !== "approved") {
        return (
            <AccountPendingMessage
                userName={profile.full_name}
                isRejected={profile.kyc_status === 'rejected'}
                reason={profile.kyc_rejection_reason}
            />
        );
    }

    if (activeTrip) {
        return (
            <div className="h-[calc(100vh-6rem)] flex flex-col relative">
                <ServiceTracking requestId={activeTrip.id} userRole="driver" initialRequestData={activeTrip} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] bg-gray-100 flex flex-col overflow-hidden">
            {/* Header - Compact with gradient */}
            <div className="flex-shrink-0 bg-gradient-to-b from-green-500 to-green-600 text-white px-5 pt-6 pb-10">
                <p className="text-green-200 text-xs mb-0.5">Hola, {profile?.full_name?.split(' ')[0] || "Conductor"}</p>
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
                            disabled={isUpdating}
                            className="data-[state=checked]:bg-green-500"
                        />
                    </div>
                </Card>
            </div>

            {/* Stats Cards - Compact */}
            <div className="flex-shrink-0 px-5 mb-3">
                <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3 bg-white shadow-sm border-0 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                            <Car className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-xl font-bold text-gray-900 text-center">{dailyStats.trips}</p>
                        <p className="text-[10px] text-gray-500 text-center">Viajes</p>
                    </Card>
                    <Card className="p-3 bg-white shadow-sm border-0 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                            <DollarSign className="h-4 w-4 text-green-500" />
                        </div>
                        <p className="text-xl font-bold text-gray-900 text-center">${dailyStats.earnings}</p>
                        <p className="text-[10px] text-gray-500 text-center">Ganado</p>
                    </Card>
                    <Card className="p-3 bg-white shadow-sm border-0 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                        </div>
                        <p className="text-xl font-bold text-gray-900 text-center">4.9</p>
                        <p className="text-[10px] text-gray-500 text-center">Rating</p>
                    </Card>
                </div>
            </div>

            {/* Scrollable Request List - Takes remaining space */}
            <div className="flex-1 overflow-y-auto px-5 pb-20 min-h-0">
                {!isAvailable ? (
                    <Card className="p-6 bg-white shadow-sm border-0 rounded-2xl text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <Zap className="h-8 w-8 text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Activa tu disponibilidad
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Hay viajes esperando cerca de ti. Conecta para empezar a recibir solicitudes.
                        </p>
                    </Card>
                ) : (
                    <>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                            <p className="font-semibold text-gray-900 text-sm">Viajes cerca de ti</p>
                        </div>
                        <Radar serviceType="taxi" isAvailable={isAvailable} />
                    </>
                )}
            </div>
        </div>
    );
}
