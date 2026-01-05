"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Radar } from "@/components/radar/radar";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { useAuth } from "@/contexts/auth-context";
import { AccountPendingMessage } from "@/components/driver/account-pending";
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

    // Don't render until mounted to prevent hydration mismatch
    if (!mounted) {
        return (
            <div className="h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        );
    }

    // Check if driver is approved
    if (profile && profile.kyc_status !== "approved") {
        return <AccountPendingMessage userName={profile.full_name} />;
    }

    if (activeTrip) {
        return (
            <div className="h-[calc(100vh-6rem)] flex flex-col relative">
                <ServiceTracking requestId={activeTrip.id} userRole="driver" initialRequestData={activeTrip} />
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            {/* Minimalist Top Bar - DiDi Style */}
            <div className="bg-white px-4 py-3 shadow-sm z-10 flex items-center justify-between pointer-events-auto">
                {/* Status Toggle - Compact */}
                <button
                    onClick={handleAvailabilityChange}
                    disabled={isUpdating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 shadow-sm ${isAvailable
                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/20'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                        }`}
                >
                    <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isAvailable ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="font-bold text-sm">
                        {isAvailable ? 'En línea' : 'Desconectado'}
                    </span>
                    {isUpdating && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </button>

                {/* Simplified Earnings - Right side */}
                <div className="flex items-center gap-3">
                    <Link href="/taxi/cuenta">
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ganancia</p>
                            <p className="text-lg font-bold text-gray-900 leading-none">
                                ${dailyStats.earnings.toFixed(0)}
                            </p>
                        </div>
                    </Link>
                    <div className="w-px h-8 bg-gray-200 mx-1" />
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 text-yellow-600">
                            <span className="text-sm font-bold">4.9</span>
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium">Rating</p>
                    </div>
                </div>
            </div>

            {/* Radar / Content Area - Fills remaining space */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
                <Radar serviceType="taxi" isAvailable={isAvailable} />
            </div>
        </div>
    );
}
