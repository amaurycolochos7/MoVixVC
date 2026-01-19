"use client";

import { useState, useEffect } from "react";
import {
    Wallet,
    TrendingUp,
    Clock,
    Loader2,
    Package,
    DollarSign,
    ChevronRight
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { ServiceDetailModal } from "@/components/mandadito/service-detail-modal";

const COMMISSION_PER_TRIP = 3;

interface CompletedTrip {
    id: string;
    final_price: number;
    origin_address: string;
    destination_address: string;
    completed_at: string;
    service_type: string;
}

interface EarningsSummary {
    totalTrips: number;
    grossEarnings: number;
    commission: number;
    netEarnings: number;
    weeklyGross: number;
    weeklyCommission: number;
    weeklyNet: number;
    weeklyTrips: number;
}

export default function MandaditoCuentaPage() {
    const supabase = createClient();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [trips, setTrips] = useState<CompletedTrip[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
    const [summary, setSummary] = useState<EarningsSummary>({
        totalTrips: 0,
        grossEarnings: 0,
        commission: 0,
        netEarnings: 0,
        weeklyGross: 0,
        weeklyCommission: 0,
        weeklyNet: 0,
        weeklyTrips: 0
    });

    useEffect(() => {
        const fetchEarnings = async () => {
            if (!user) return;

            try {
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);

                const { data: allTrips, error } = await supabase
                    .from("service_requests")
                    .select("id, final_price, origin_address, destination_address, completed_at, service_type")
                    .eq("assigned_driver_id", user.id)
                    .eq("status", "completed")
                    .eq("service_type", "mandadito")
                    .order("completed_at", { ascending: false });

                if (error) throw error;

                const completedTrips = allTrips || [];
                setTrips(completedTrips.slice(0, 10));

                const grossEarnings = completedTrips.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const commission = completedTrips.length * COMMISSION_PER_TRIP;
                const netEarnings = grossEarnings - commission;

                const weeklyTrips = completedTrips.filter(trip =>
                    new Date(trip.completed_at) >= startOfWeek
                );
                const weeklyGross = weeklyTrips.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const weeklyCommission = weeklyTrips.length * COMMISSION_PER_TRIP;
                const weeklyNet = weeklyGross - weeklyCommission;

                setSummary({
                    totalTrips: completedTrips.length,
                    grossEarnings,
                    commission,
                    netEarnings,
                    weeklyGross,
                    weeklyCommission,
                    weeklyNet,
                    weeklyTrips: weeklyTrips.length
                });

            } catch (err) {
                console.error("Error fetching earnings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEarnings();
    }, [user]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-5 pt-6 pb-24">
                <h1 className="text-xl font-bold text-white mb-6">Mi Cuenta</h1>

                {/* Main Balance */}
                <div className="text-center">
                    <p className="text-orange-100 text-sm mb-1">Ganancias esta semana</p>
                    <p className="text-white text-5xl font-black">${summary.weeklyNet.toFixed(2)}</p>
                    <p className="text-orange-200 text-sm mt-2">{summary.weeklyTrips} mandados completados</p>
                </div>
            </div>

            {/* Stats Cards - Floating */}
            <div className="px-4 -mt-12">
                <div className="bg-white rounded-2xl shadow-lg p-4">
                    <div className="grid grid-cols-3 divide-x divide-gray-100">
                        <div className="text-center px-2">
                            <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <Package className="h-5 w-5 text-orange-500" />
                            </div>
                            <p className="text-xl font-bold text-gray-900">{summary.weeklyTrips}</p>
                            <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div className="text-center px-2">
                            <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <TrendingUp className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="text-xl font-bold text-gray-900">${summary.weeklyGross.toFixed(0)}</p>
                            <p className="text-xs text-gray-500">Cobrado</p>
                        </div>
                        <div className="text-center px-2">
                            <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-2">
                                <DollarSign className="h-5 w-5 text-amber-500" />
                            </div>
                            <p className="text-xl font-bold text-gray-900">${summary.weeklyCommission.toFixed(0)}</p>
                            <p className="text-xs text-gray-500">Comisión</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Commission Alert */}
            {summary.weeklyCommission > 0 && (
                <div className="px-4 mt-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Wallet className="h-5 w-5 text-amber-600" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">Comisión pendiente</p>
                                <p className="text-xs text-amber-600">${summary.weeklyCommission.toFixed(2)} este corte</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Trips */}
            <div className="px-4 mt-6">
                <h3 className="font-bold text-gray-900 mb-3">Historial</h3>

                {trips.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Package className="h-7 w-7 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">Sin mandados completados</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                        {trips.map((trip) => (
                            <button
                                key={trip.id}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                                onClick={() => setSelectedServiceId(trip.id)}
                            >
                                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Package className="h-5 w-5 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {trip.destination_address || trip.origin_address}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                            {new Date(trip.completed_at).toLocaleDateString('es-MX', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-green-600 font-bold">
                                        +${(trip.final_price - COMMISSION_PER_TRIP).toFixed(0)}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-gray-300" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Service Detail Modal */}
            {selectedServiceId && (
                <ServiceDetailModal
                    serviceId={selectedServiceId}
                    onClose={() => setSelectedServiceId(null)}
                />
            )}
        </div>
    );
}
