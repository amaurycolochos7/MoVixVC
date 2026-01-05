"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Wallet, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard Admin</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/usuarios">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loading ? "..." : stats.totalUsers}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Registrados en plataforma
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/servicios">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Servicios Hoy</CardTitle>
                            <Car className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loading ? "..." : stats.servicesToday}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 text-green-600 font-medium">
                                {loading ? "..." : stats.servicesInProgress} en curso ahora
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/admin/finanzas">
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos Estimados</CardTitle>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {loading ? "..." : `$${stats.todayRevenue.toFixed(2)}`}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Comisiones generadas hoy
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/admin/kyc">
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer border-l-4 border-l-yellow-400">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Pendientes de Verificación
                                <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-yellow-600">
                                    {loading ? "..." : stats.pendingKyc}
                                </span>
                                <span className="text-muted-foreground">conductores esperando revisión</span>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    );
}
