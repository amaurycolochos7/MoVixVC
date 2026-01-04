"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Radar } from "@/components/radar/radar";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Power, TrendingUp, Star, Clock, ChevronRight, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface DailyStats {
    trips: number;
    earnings: number;
}

export default function TaxiHomePage() {
    const { profile, refreshProfile } = useAuth();
    const [isAvailable, setIsAvailable] = useState(() => profile?.is_available ?? false);
    const [isUpdating, setIsUpdating] = useState(false);
    const { activeTrip } = useActiveTrip("driver");
    const supabase = createClient();

    // Real daily stats
    const [dailyStats, setDailyStats] = useState<DailyStats>({ trips: 0, earnings: 0 });

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
                .eq("status", "completed")
                .gte("completed_at", today.toISOString());

            if (!error && data) {
                const earnings = data.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const commission = data.length * 3; // $3 per trip
                setDailyStats({
                    trips: data.length,
                    earnings: earnings - commission // Net after $3/trip commission
                });
            }
        };

        fetchDailyStats();
    }, [profile?.id]);

    // Sync local state with profile
    useEffect(() => {
        if (profile) {
            setIsAvailable(profile.is_available ?? false);
        }
    }, [profile]);

    // Refresh profile on mount
    useEffect(() => {
        refreshProfile();
    }, []);

    const handleAvailabilityChange = async () => {
        if (!profile || isUpdating) return;

        const newValue = !isAvailable;
        setIsUpdating(true);
        setIsAvailable(newValue);

        try {
            const { error } = await supabase
                .from("users")
                .update({ is_available: newValue })
                .eq("id", profile.id);

            if (error) {
                toast.error("Error al actualizar disponibilidad");
                setIsAvailable(!newValue);
            } else {
                toast.success(newValue ? "¡Estás en línea!" : "Desconectado");
                refreshProfile();
            }
        } catch (err) {
            setIsAvailable(!newValue);
        } finally {
            setIsUpdating(false);
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
        <div className="min-h-screen bg-gray-100">
            {/* Header - Light */}
            <div className="bg-white px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Hola,</p>
                        <h1 className="text-xl font-bold text-gray-900">{profile?.full_name?.split(' ')[0] || 'Conductor'}</h1>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-100 px-3 py-1.5 rounded-full">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-sm text-yellow-700">4.9</span>
                    </div>
                </div>
            </div>

            {/* Go Online Button */}
            <div className="p-4">
                <button
                    onClick={handleAvailabilityChange}
                    disabled={isUpdating}
                    className={`w-full rounded-2xl p-5 transition-all duration-300 shadow-lg ${isAvailable
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gray-700'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isAvailable ? 'bg-white/20' : 'bg-gray-600'
                                }`}>
                                {isUpdating ? (
                                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                                ) : (
                                    <Power className="w-7 h-7 text-white" />
                                )}
                            </div>
                            <div className="text-left">
                                <h2 className="text-xl font-bold text-white">
                                    {isAvailable ? 'En línea' : 'Desconectado'}
                                </h2>
                                <p className="text-sm text-white/80">
                                    {isAvailable ? 'Recibiendo solicitudes...' : 'Toca para comenzar'}
                                </p>
                            </div>
                        </div>
                        {isAvailable && (
                            <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                                <Zap className="w-4 h-4 text-white" />
                                <span className="text-sm font-medium text-white">Activo</span>
                            </div>
                        )}
                    </div>
                </button>
            </div>

            {/* Earnings Summary - Light */}
            <div className="px-4 pb-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-800">Resumen del día</h3>
                        <Link href="/taxi/cuenta">
                            <Button variant="ghost" size="sm" className="text-primary text-sm h-8">
                                Ver todo <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-blue-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{dailyStats.trips}</p>
                            <p className="text-xs text-gray-500">Viajes</p>
                        </div>
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                            <p className="text-2xl font-bold text-green-600">${dailyStats.earnings.toFixed(0)}</p>
                            <p className="text-xs text-gray-500">Ganancia</p>
                        </div>
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-100 flex items-center justify-center">
                                <Star className="w-5 h-5 text-purple-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">--</p>
                            <p className="text-xs text-gray-500">Rating</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Requests Section */}
            <div className="px-4 pb-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900">Solicitudes cercanas</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${isAvailable
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-500'
                        }`}>
                        {isAvailable ? '● Activo' : '○ Inactivo'}
                    </span>
                </div>
            </div>

            {/* Radar */}
            <div className="bg-white rounded-t-3xl min-h-[35vh] shadow-lg">
                <Radar serviceType="taxi" isAvailable={isAvailable} />
            </div>
        </div>
    );
}
