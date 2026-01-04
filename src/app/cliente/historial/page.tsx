"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Package, ArrowLeft, Loader2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface Trip {
    id: string;
    service_type: string;
    destination_address: string;
    origin_address: string;
    final_price: number;
    status: string;
    completed_at: string | null;
    created_at: string;
}

export default function ClienteHistorialPage() {
    const router = useRouter();
    const supabase = createClient();
    const { user } = useAuth();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTrips = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from("service_requests")
                    .select("id, service_type, destination_address, origin_address, final_price, status, completed_at, created_at")
                    .eq("client_id", user.id)
                    .in("status", ["completed", "cancelled"])
                    .order("created_at", { ascending: false });

                if (!error && data) {
                    setTrips(data);
                }
            } catch (err) {
                console.error("Error fetching trips:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchTrips();
    }, [user]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4 pb-20">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-xl font-bold">Historial de Viajes</h1>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : trips.length === 0 ? (
                <Card className="bg-slate-50 border-dashed border-2 border-slate-200 shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-text-muted gap-2">
                        <Clock className="h-10 w-10 text-slate-300" />
                        <p className="font-medium text-slate-400">No tienes viajes en tu historial</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {trips.map((trip) => (
                        <Card key={trip.id} className="border-0 shadow-sm bg-white">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${trip.service_type === 'taxi'
                                            ? 'bg-blue-100'
                                            : 'bg-purple-100'
                                        }`}>
                                        {trip.service_type === 'taxi' ? (
                                            <Car className={`w-6 h-6 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-blue-600'}`} />
                                        ) : (
                                            <Package className={`w-6 h-6 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-purple-600'}`} />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            {trip.destination_address || trip.origin_address || `Viaje ${trip.service_type}`}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {formatDate(trip.completed_at || trip.created_at)}
                                        </p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${trip.status === 'completed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                            }`}>
                                            {trip.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-lg font-bold ${trip.status === 'cancelled' ? 'text-red-500 line-through' : 'text-slate-700'
                                        }`}>
                                        ${trip.final_price || 0}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
