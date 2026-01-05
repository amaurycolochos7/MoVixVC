"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Wallet } from "lucide-react";

interface FinancialRecord {
    id: string;
    final_price: number;
    commission_amount: number;
    created_at: string;
    client: { full_name: string } | null;
    driver: { full_name: string } | null;
}

export default function AdminFinanzasPage() {
    const [records, setRecords] = useState<FinancialRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        averageTicket: 0,
        completedServices: 0
    });

    const supabase = createClient();

    useEffect(() => {
        const fetchFinances = async () => {
            try {
                // Fetch completed services with revenue data
                const { data, error } = await supabase
                    .from("service_requests")
                    .select(`
                        id,
                        final_price,
                        commission_amount,
                        created_at,
                        client:users!client_id(full_name),
                        driver:users!assigned_driver_id(full_name)
                    `)
                    .eq("status", "completed")
                    .order("created_at", { ascending: false });

                if (error) throw error;

                // @ts-ignore
                const services: FinancialRecord[] = data || [];
                setRecords(services);

                // Calculate stats
                const revenue = services.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0);
                const count = services.length;
                const avg = count > 0 ? revenue / count : 0;

                setStats({
                    totalRevenue: revenue,
                    averageTicket: avg,
                    completedServices: count
                });
            } catch (error) {
                console.error("Error fetching finances:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFinances();
    }, [supabase]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Finanzas e Ingresos</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales (Comisiones)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            {loading ? "..." : `$${stats.totalRevenue.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Acumulado histórico</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? "..." : `$${stats.averageTicket.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ingreso promedio por viaje</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Servicios Completados</CardTitle>
                        <Wallet className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? "..." : stats.completedServices}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Transacciones exitosas</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Transacciones</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>ID Servicio</TableHead>
                                        <TableHead>Conductor</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Monto Viaje</TableHead>
                                        <TableHead className="text-right font-bold">Comisión</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {records.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell>
                                                <div className="flex flex-col text-sm text-muted-foreground">
                                                    {format(new Date(record.created_at), "dd MMM yyyy", { locale: es })}
                                                    <span className="text-xs">{format(new Date(record.created_at), "HH:mm", { locale: es })}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs">{record.id.slice(0, 8)}</span>
                                            </TableCell>
                                            <TableCell>
                                                {record.driver?.full_name || "Desconocido"}
                                            </TableCell>
                                            <TableCell>
                                                {record.client?.full_name || "Desconocido"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ${(record.final_price || 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-green-600">
                                                +${(record.commission_amount || 0).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {records.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center p-8 text-muted-foreground">
                                                No hay registros financieros disponibles.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
