"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Car, Package, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";

interface RecentTrip {
    id: string;
    service_type: string;
    destination_address: string;
    origin_address: string;
    final_price: number;
    status: string;
    completed_at: string | null;
    created_at: string;
}

export default function ClienteHomePage() {
    const supabase = createClient();
    const { user } = useAuth();
    const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecentTrips = async () => {
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
                    .order("created_at", { ascending: false })
                    .limit(5);

                if (!error && data) {
                    setRecentTrips(data);
                }
            } catch (err) {
                console.error("Error fetching trips:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecentTrips();
    }, [user]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return `Hoy, ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (isYesterday) {
            return `Ayer, ${date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            return date.toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <header className="flex items-center justify-between px-1">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">MoVix</h1>
                    <p className="text-sm text-text-muted">¿Qué quieres hacer hoy?</p>
                </div>
            </header>

            <section className="grid grid-cols-2 gap-4">
                <Link href="/cliente/taxi">
                    <Card className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/50 border-0 shadow-md h-44">
                        <CardContent className="flex flex-col items-center justify-center h-full gap-2 p-4">
                            <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                                <Car className="h-8 w-8" />
                            </div>
                            <span className="font-bold text-lg text-slate-700">Taxi</span>
                            <span className="text-xs text-slate-500 text-center">Transporte rápido y seguro</span>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/cliente/mandadito">
                    <Card className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 bg-gradient-to-br from-white to-purple-50/50 border-0 shadow-md h-44">
                        <CardContent className="flex flex-col items-center justify-center h-full gap-2 p-4">
                            <div className="p-3 bg-purple-100 rounded-full text-purple-600">
                                <Package className="h-8 w-8" />
                            </div>
                            <span className="font-bold text-lg text-slate-700">Mandadito</span>
                            <span className="text-xs text-slate-500 text-center">Envía o recoge paquetes</span>
                        </CardContent>
                    </Card>
                </Link>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-lg font-bold text-slate-800">Historial Reciente</h2>
                    <Link href="/cliente/historial" className="text-xs text-primary font-semibold hover:underline">
                        Ver todo
                    </Link>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : recentTrips.length === 0 ? (
                    <Card className="bg-slate-50 border-dashed border-2 border-slate-200 shadow-none">
                        <CardContent className="flex flex-col items-center justify-center py-10 text-text-muted gap-2">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                <Clock className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-400">Aún no tienes viajes</p>
                            <Link href="/cliente/taxi" className="text-primary hover:underline">
                                Solicitar tu primer viaje
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {recentTrips.map((trip) => (
                            <Card key={trip.id} className="border-0 shadow-sm bg-white hover:bg-slate-50 transition-colors">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${trip.service_type === 'taxi'
                                                ? 'bg-blue-100'
                                                : 'bg-purple-100'
                                            }`}>
                                            {trip.service_type === 'taxi' ? (
                                                <Car className={`w-5 h-5 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-blue-600'}`} />
                                            ) : (
                                                <Package className={`w-5 h-5 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-purple-600'}`} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 truncate max-w-[180px]">
                                                {trip.destination_address || trip.origin_address || 'Viaje'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {formatDate(trip.completed_at || trip.created_at)} • {
                                                    trip.status === 'completed' ? 'Finalizado' :
                                                        trip.status === 'cancelled' ? 'Cancelado' : trip.status
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`font-bold ${trip.status === 'cancelled' ? 'text-red-500' : 'text-slate-700'}`}>
                                        ${trip.final_price || 0}
                                    </span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
