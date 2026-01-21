"use client";

import { useState, useEffect } from "react";
import { Car, Bike, Clock, Loader2, MapPin, ChevronRight, ShoppingBag, Package, AlertCircle } from "lucide-react";
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
    const { user, profile } = useAuth();
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
                    .limit(3);

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

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Buenos días";
        if (hour < 18) return "Buenas tardes";
        return "Buenas noches";
    };

    const firstName = profile?.full_name?.split(' ')[0] || 'Usuario';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 px-5 pt-12 pb-16 rounded-b-[2rem]">
                {/* Greeting */}
                <div>
                    <p className="text-white/80 text-sm font-medium">{getGreeting()}</p>
                    <h1 className="text-2xl font-bold text-white">{firstName}</h1>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-5 -mt-10">
                {/* Service Cards - 3 Columns */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {/* Taxi Card - PAUSADO */}
                    <div className="relative">
                        <div className="bg-white rounded-2xl p-3 shadow-md opacity-60 grayscale cursor-not-allowed">
                            <div className="h-24 flex items-center justify-center mb-2">
                                <img src="/taxi.png" alt="Taxi" className="h-full object-contain" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-gray-900 text-sm">Taxi</h3>
                                <p className="text-amber-600 text-[10px] flex items-center justify-center gap-0.5">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    Pausado
                                </p>
                            </div>
                        </div>
                        {/* Tooltip on tap/hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/70 rounded-2xl">
                            <p className="text-white text-[9px] text-center px-2 leading-tight">
                                En espera de autorización local
                            </p>
                        </div>
                    </div>

                    {/* Mandadito Card */}
                    <Link href="/cliente/mandadito">
                        <div className="bg-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-shadow">
                            <div className="h-24 flex items-center justify-center mb-2">
                                <img src="/delivery-moto.png" alt="Mandadito" className="h-full object-contain" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-orange-600 text-sm">Mandadito</h3>
                                <p className="text-gray-500 text-[10px]">Envíos y compras</p>
                            </div>
                        </div>
                    </Link>

                    {/* Moto Ride Card */}
                    <Link href="/cliente/moto-ride">
                        <div className="bg-white rounded-2xl p-3 shadow-md hover:shadow-lg transition-shadow">
                            <div className="h-24 flex items-center justify-center mb-2">
                                <img src="/moto-ride.png" alt="Moto Ride" className="h-full object-contain" />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-gray-900 text-sm">Moto Ride</h3>
                                <p className="text-gray-500 text-[10px]">Viaje en moto</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Servicios populares</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <Link href="/cliente/mandadito" className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <ShoppingBag className="h-5 w-5 text-purple-600" />
                            </div>
                            <span className="text-xs text-gray-600 text-center">Compras</span>
                        </Link>
                        <Link href="/cliente/mandadito" className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Package className="h-5 w-5 text-emerald-600" />
                            </div>
                            <span className="text-xs text-gray-600 text-center">Envíos</span>
                        </Link>
                        {/* Viajes - Pausado */}
                        <div className="flex flex-col items-center gap-2 opacity-50 cursor-not-allowed">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <Car className="h-5 w-5 text-gray-400" />
                            </div>
                            <span className="text-xs text-gray-400 text-center">Viajes</span>
                        </div>
                        <Link href="/cliente/historial" className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <span className="text-xs text-gray-600 text-center">Historial</span>
                        </Link>
                    </div>
                </div>

                {/* Recent Trips */}
                <div className="mb-24">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Historial reciente</h3>
                        <Link href="/cliente/historial" className="text-sm text-orange-500 font-medium">
                            Ver todo
                        </Link>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                        </div>
                    ) : recentTrips.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="h-7 w-7 text-gray-300" />
                            </div>
                            <p className="text-gray-500 mb-2 font-medium">Aún no tienes viajes</p>
                            <Link href="/cliente/taxi" className="text-orange-500 font-medium text-sm">
                                Solicitar tu primer viaje
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recentTrips.map((trip) => (
                                <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${trip.service_type === 'moto_ride'
                                        ? 'bg-purple-100'
                                        : trip.service_type === 'taxi'
                                            ? 'bg-blue-100'
                                            : 'bg-orange-100'
                                        }`}>
                                        {trip.service_type === 'taxi' ? (
                                            <Car className={`w-5 h-5 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-blue-600'}`} />
                                        ) : trip.service_type === 'moto_ride' ? (
                                            <Bike className={`w-5 h-5 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-purple-600'}`} />
                                        ) : (
                                            <Bike className={`w-5 h-5 ${trip.status === 'cancelled' ? 'text-red-500' : 'text-orange-600'}`} />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate text-sm">
                                            {trip.destination_address || trip.origin_address || 'Viaje'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {formatDate(trip.completed_at || trip.created_at)} • {
                                                trip.status === 'completed' ? (
                                                    <span className="text-emerald-600">Completado</span>
                                                ) : trip.status === 'cancelled' ? (
                                                    <span className="text-red-500">Cancelado</span>
                                                ) : trip.status
                                            }
                                        </p>
                                    </div>
                                    <span className={`font-bold flex-shrink-0 ${trip.status === 'cancelled' ? 'text-gray-400' : 'text-gray-900'}`}>
                                        ${trip.final_price || 0}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
