"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Wallet, ArrowRight, AlertCircle, TrendingUp, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AdminDashboardPage() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        servicesToday: 0,
        servicesInProgress: 0,
        todayRevenue: 0,
        pendingKyc: 0
    });
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. Total Users
                const { count: userCount } = await supabase
                    .from("users")
                    .select("*", { count: "exact", head: true });

                // 2. Pending KYC
                const { count: pendingCount } = await supabase
                    .from("users")
                    .select("*", { count: "exact", head: true })
                    .eq("kyc_status", "pending")
                    .in("role", ["taxi", "mandadito"]);

                // Date setup for "Today"
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayIso = today.toISOString();

                // 3. Services Today (Completed) & Revenue
                const { data: todayServices } = await supabase
                    .from("service_requests")
                    .select("commission_amount")
                    .eq("status", "completed")
                    .gte("created_at", todayIso);

                const servicesCount = todayServices?.length || 0;
                const revenue = todayServices?.reduce((sum, service) => sum + (service.commission_amount || 0), 0) || 0;

                // 4. Services In Progress
                const { count: inProgressCount } = await supabase
                    .from("service_requests")
                    .select("*", { count: "exact", head: true })
                    .in("status", ["in_progress", "assigned"]);

                setStats({
                    totalUsers: userCount || 0,
                    servicesToday: servicesCount,
                    servicesInProgress: inProgressCount || 0,
                    todayRevenue: revenue,
                    pendingKyc: pendingCount || 0
                });
            } catch (error) {
                console.error("Error fetching admin stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [supabase]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href="/admin/usuarios">
                    <Card className="group hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-indigo-200 cursor-pointer bg-gradient-to-br from-white to-indigo-50/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Usuarios Totales</CardTitle>
                            <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                                <Users className="h-5 w-5 text-indigo-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-gray-900">
                                {loading ? "..." : stats.totalUsers}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                Registrados en plataforma
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/servicios">
                    <Card className="group hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-green-200 cursor-pointer bg-gradient-to-br from-white to-green-50/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Servicios Hoy</CardTitle>
                            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                                <Car className="h-5 w-5 text-green-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-gray-900">
                                {loading ? "..." : stats.servicesToday}
                            </div>
                            <p className="text-xs text-green-600 font-medium mt-2 flex items-center gap-1">
                                <Activity className="w-3 h-3" />
                                {loading ? "..." : stats.servicesInProgress} en curso ahora
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/finanzas">
                    <Card className="group hover:shadow-lg transition-all duration-300 border-2 border-transparent hover:border-purple-200 cursor-pointer bg-gradient-to-br from-white to-purple-50/30">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-gray-600">Ingresos Hoy</CardTitle>
                            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                                <Wallet className="h-5 w-5 text-purple-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-gray-900">
                                {loading ? "..." : `$${stats.todayRevenue.toFixed(2)}`}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Comisiones generadas
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Alert Pending KYC */}
            {stats.pendingKyc > 0 && (
                <Link href="/admin/kyc">
                    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50/50 to-white">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-amber-100 rounded-xl">
                                        <AlertCircle className="w-6 h-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">
                                            Verificaciones Pendientes
                                        </h3>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-bold text-amber-600">
                                                {loading ? "..." : stats.pendingKyc}
                                            </span>
                                            <span className="text-gray-600">conductores esperando revisión</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Haz clic para revisar y aprobar conductores
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-6 h-6 text-gray-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            )}

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Acceso Rápido</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link href="/admin/usuarios">
                        <div className="p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer">
                            <Users className="w-6 h-6 text-indigo-600 mb-2" />
                            <p className="text-sm font-medium text-gray-900">Usuarios</p>
                        </div>
                    </Link>
                    <Link href="/admin/kyc">
                        <div className="p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-amber-200 hover:shadow-md transition-all cursor-pointer">
                            <AlertCircle className="w-6 h-6 text-amber-600 mb-2" />
                            <p className="text-sm font-medium text-gray-900">KYC</p>
                        </div>
                    </Link>
                    <Link href="/admin/servicios">
                        <div className="p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-green-200 hover:shadow-md transition-all cursor-pointer">
                            <Car className="w-6 h-6 text-green-600 mb-2" />
                            <p className="text-sm font-medium text-gray-900">Servicios</p>
                        </div>
                    </Link>
                    <Link href="/admin/finanzas">
                        <div className="p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer">
                            <Wallet className="w-6 h-6 text-purple-600 mb-2" />
                            <p className="text-sm font-medium text-gray-900">Finanzas</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
