"use client";

import { useState, useEffect } from "react";
import {
    Wallet,
    TrendingUp,
    Clock,
    Loader2,
    Package,
    DollarSign,
    ChevronRight,
    Bike,
    XCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { ServiceDetailModal } from "@/components/mandadito/service-detail-modal";

interface CompletedTrip {
    id: string;
    final_price: number;
    origin_address: string;
    destination_address: string;
    completed_at: string;
    service_type: string;
    status: string;
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

                // Fetch ALL services (mandadito + moto_ride) - completed for earnings
                const { data: completedTrips, error } = await supabase
                    .from("service_requests")
                    .select("id, final_price, origin_address, destination_address, completed_at, service_type, status")
                    .eq("assigned_driver_id", user.id)
                    .eq("status", "completed")
                    .in("service_type", ["mandadito", "moto_ride"])
                    .order("completed_at", { ascending: false });

                // Fetch cancelled services for complete history
                const { data: cancelledServices } = await supabase
                    .from("service_requests")
                    .select("id, final_price, origin_address, destination_address, cancelled_at, service_type, status")
                    .eq("assigned_driver_id", user.id)
                    .eq("status", "cancelled")
                    .in("service_type", ["mandadito", "moto_ride"])
                    .order("cancelled_at", { ascending: false })
                    .limit(20);

                if (error) throw error;

                const allCompleted = completedTrips || [];

                // Combine completed and cancelled for history display
                const allHistory = [
                    ...allCompleted.map(t => ({ ...t, timestamp: t.completed_at })),
                    ...(cancelledServices || []).map(t => ({ ...t, timestamp: t.cancelled_at, completed_at: t.cancelled_at }))
                ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                setTrips(allHistory.slice(0, 15) as any);

                // Calculate commission based on service type
                // Mandadito: $3, Moto Ride: $5
                const getCommission = (serviceType: string) => serviceType === 'moto_ride' ? 5 : 3;

                const grossEarnings = allCompleted.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const commission = allCompleted.reduce((sum, trip) => sum + getCommission(trip.service_type), 0);
                const netEarnings = grossEarnings - commission;

                const weeklyTrips = allCompleted.filter(trip =>
                    new Date(trip.completed_at) >= startOfWeek
                );
                const weeklyGross = weeklyTrips.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const weeklyCommission = weeklyTrips.reduce((sum, trip) => sum + getCommission(trip.service_type), 0);
                const weeklyNet = weeklyGross - weeklyCommission;

                setSummary({
                    totalTrips: allCompleted.length,
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
                    <p className="text-orange-200 text-sm mt-2">{summary.weeklyTrips} servicios completados</p>
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

            {/* Commission Alert with Payment Deadline */}
            {summary.weeklyCommission > 0 && (() => {
                // Calculate next Sunday
                const now = new Date();
                const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
                const nextSunday = new Date(now);
                nextSunday.setDate(now.getDate() + daysUntilSunday);

                const deadlineText = nextSunday.toLocaleDateString('es-MX', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                });

                return (
                    <div className="px-4 mt-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Wallet className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-amber-800">Comisión pendiente</p>
                                    <p className="text-lg font-bold text-amber-900">${summary.weeklyCommission.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-amber-200">
                                <p className="text-xs text-amber-700 font-medium">
                                    Fecha límite: <span className="capitalize">{deadlineText}</span>
                                </p>
                                <p className="text-[10px] text-amber-600 mt-0.5">
                                    Paga antes del lunes para mantener tu acceso activo
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Recent Trips */}
            <div className="px-4 mt-6">
                <h3 className="font-bold text-gray-900 mb-3">Historial</h3>

                {trips.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Package className="h-7 w-7 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">Sin servicios completados</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                        {trips.map((trip) => {
                            const isCancelled = trip.status === 'cancelled';
                            const isMotoRide = trip.service_type === 'moto_ride';
                            const commission = isMotoRide ? 5 : 3;
                            const netEarning = (trip.final_price || 0) - commission;

                            return (
                                <button
                                    key={trip.id}
                                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${isCancelled ? 'opacity-70' : ''}`}
                                    onClick={() => setSelectedServiceId(trip.id)}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isCancelled ? 'bg-red-50' : isMotoRide ? 'bg-purple-50' : 'bg-orange-50'
                                        }`}>
                                        {isCancelled ? (
                                            <XCircle className="h-5 w-5 text-red-500" />
                                        ) : isMotoRide ? (
                                            <Bike className="h-5 w-5 text-purple-500" />
                                        ) : (
                                            <Package className="h-5 w-5 text-orange-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {trip.destination_address || trip.origin_address}
                                            </p>
                                            {isMotoRide && !isCancelled && (
                                                <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Moto</span>
                                            )}
                                        </div>
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
                                            {isCancelled && (
                                                <span className="text-red-500 ml-1">• Cancelado</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {isCancelled ? (
                                            <span className="text-gray-400 font-medium text-sm">$0</span>
                                        ) : (
                                            <span className="text-green-600 font-bold">
                                                +${netEarning.toFixed(0)}
                                            </span>
                                        )}
                                        <ChevronRight className="h-4 w-4 text-gray-300" />
                                    </div>
                                </button>
                            );
                        })}
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
