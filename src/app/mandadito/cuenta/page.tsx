"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
    Wallet,
    TrendingUp,
    Clock,
    CheckCircle,
    Loader2,
    Package,
    DollarSign,
    AlertCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { ServiceDetailModal } from "@/components/mandadito/service-detail-modal";

// Flat commission per trip (mandadito = $3 MXN)
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
        weeklyNet: 0
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
                const commission = grossEarnings * 0.1071; // ~10.71% commission (3/28)
                const netEarnings = grossEarnings - commission;

                const weeklyTrips = completedTrips.filter(trip =>
                    new Date(trip.completed_at) >= startOfWeek
                );
                const weeklyGross = weeklyTrips.reduce((sum, trip) => sum + (trip.final_price || 0), 0);
                const weeklyCommission = weeklyGross * 0.1071;
                const weeklyNet = weeklyGross - weeklyCommission;

                setSummary({
                    totalTrips: completedTrips.length,
                    grossEarnings,
                    commission,
                    netEarnings,
                    weeklyGross,
                    weeklyCommission,
                    weeklyNet
                });

            } catch (err) {
                console.error("Error fetching earnings:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchEarnings();
    }, [user]);

    const getEndOfWeek = () => {
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
        return endOfWeek.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <h1 className="text-xl font-bold">Mi Cuenta</h1>

            {/* Weekly Balance Card */}
            <Card className="bg-gradient-to-br from-purple-800 to-purple-900 text-white">
                <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-white/70">Ganancias Netas (Semana)</p>
                            <p className="text-3xl font-bold">${summary.weeklyNet.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                        <div>
                            <p className="text-xs text-white/50">Ganado</p>
                            <p className="font-semibold">${summary.weeklyNet.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-white/50">Mandados</p>
                            <p className="font-semibold">{summary.totalTrips}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Commission Owed Card */}
            <Card className={`${summary.weeklyCommission > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {summary.weeklyCommission > 0 ? (
                                <AlertCircle className="h-5 w-5 text-amber-600" />
                            ) : (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            )}
                            <div>
                                <p className="text-sm font-medium text-slate-700">Comisión ($3/mandado)</p>
                                <p className="text-xs text-slate-500">Corte: {getEndOfWeek()}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className={`text-xl font-bold ${summary.weeklyCommission > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                ${summary.weeklyCommission.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                    <Package className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                    <p className="text-lg font-bold">{summary.totalTrips}</p>
                    <p className="text-xs text-text-secondary">Mandados</p>
                </Card>
                <Card className="p-3 text-center">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-bold">${summary.netEarnings.toFixed(0)}</p>
                    <p className="text-xs text-text-secondary">Ganado</p>
                </Card>
                <Card className="p-3 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-lg font-bold">${summary.commission.toFixed(0)}</p>
                    <p className="text-xs text-text-secondary">Comisión</p>
                </Card>
            </div>

            {/* Recent Trips */}
            <section>
                <h3 className="font-semibold mb-3">Mandados Completados</h3>
                {trips.length === 0 ? (
                    <Card>
                        <CardContent className="p-6 text-center">
                            <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-text-muted">No hay mandados completados</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {trips.map((trip) => (
                            <Card
                                key={trip.id}
                                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => setSelectedServiceId(trip.id)}
                            >
                                <div className="p-4 flex gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 mb-1 line-clamp-2">
                                            {trip.destination_address || trip.origin_address}
                                        </p>
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Clock className="h-3 w-3 flex-shrink-0" />
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
                                    <div className="flex-shrink-0 text-right">
                                        <p className="text-lg font-bold text-green-600">
                                            ${(trip.final_price - COMMISSION_PER_TRIP).toFixed(2)}
                                        </p>
                                        <p className="text-xs text-slate-500">neto</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

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
