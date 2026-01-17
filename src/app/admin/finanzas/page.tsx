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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, DollarSign, Wallet, Car, Package, Filter } from "lucide-react";

interface FinancialRecord {
    id: string;
    final_price: number;
    commission_amount: number;
    created_at: string;
    service_type: "taxi" | "mandadito";
    client: { full_name: string } | null;
    driver: { full_name: string } | null;
}

export default function AdminFinanzasPage() {
    const [records, setRecords] = useState<FinancialRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<FinancialRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<"all" | "taxi" | "mandadito">("all");

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
                        service_type,
                        client:users!client_id(full_name),
                        driver:users!assigned_driver_id(full_name)
                    `)
                    .eq("status", "completed")
                    .order("created_at", { ascending: false });

                if (error) throw error;

                // @ts-ignore
                const services: FinancialRecord[] = data || [];
                setRecords(services);
                setFilteredRecords(services);
            } catch (error) {
                console.error("Error fetching finances:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFinances();
    }, [supabase]);

    useEffect(() => {
        if (filterType === "all") {
            setFilteredRecords(records);
        } else {
            setFilteredRecords(records.filter(r => r.service_type === filterType));
        }
    }, [filterType, records]);

    // Calculate stats based on FILTERED records
    const stats = {
        totalRevenue: filteredRecords.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0),
        averageTicket: filteredRecords.length > 0
            ? filteredRecords.reduce((acc, curr) => acc + (curr.commission_amount || 0), 0) / filteredRecords.length
            : 0,
        completedServices: filteredRecords.length
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-2xl font-bold">Finanzas e Ingresos</h1>

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-lg border">
                    <Button
                        variant={filterType === "all" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("all")}
                        className="text-xs sm:text-sm"
                    >
                        Todos
                    </Button>
                    <Button
                        variant={filterType === "taxi" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("taxi")}
                        className="text-xs sm:text-sm gap-2"
                    >
                        <Car className="w-3 h-3 sm:w-4 sm:h-4" />
                        Taxis
                    </Button>
                    <Button
                        variant={filterType === "mandadito" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("mandadito")}
                        className="text-xs sm:text-sm gap-2"
                    >
                        <Package className="w-3 h-3 sm:w-4 sm:h-4" />
                        Mandaditos
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos Totales (Comisiones)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            {loading ? "..." : `$${stats.totalRevenue.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {filterType === 'all' ? 'Acumulado histórico total' : `Total histórico de ${filterType}`}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? "..." : `$${stats.averageTicket.toFixed(2)}`}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Comisión promedio por servicio
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Servicios Completados</CardTitle>
                        <Wallet className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? "..." : stats.completedServices}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {filterType === 'all' ? 'Total de viajes finalizados' : `Viajes de ${filterType} finalizados`}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Historial de Transacciones</CardTitle>
                    <div className="text-sm text-muted-foreground">
                        Mostrando {filteredRecords.length} registros
                    </div>
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
                                        <TableHead className="w-[100px]">Tipo</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>ID Servicio</TableHead>
                                        <TableHead>Conductor</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Monto Viaje</TableHead>
                                        <TableHead className="text-right font-bold">Comisión</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRecords.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell>
                                                {record.service_type === 'taxi' ? (
                                                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit text-xs font-medium">
                                                        <Car className="w-4 h-4" /> Taxi
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-2 py-1 rounded w-fit text-xs font-medium">
                                                        <Package className="w-4 h-4" /> Envío
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm text-muted-foreground">
                                                    {format(new Date(record.created_at), "dd MMM", { locale: es })}
                                                    <span className="text-xs">{format(new Date(record.created_at), "HH:mm", { locale: es })}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground">{record.id.slice(0, 8)}</span>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {record.driver?.full_name || "Desconocido"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {record.client?.full_name || "Desconocido"}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                ${(record.final_price || 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-green-600">
                                                +${(record.commission_amount || 0).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center p-12 text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Filter className="w-8 h-8 opacity-20" />
                                                    <p>No hay registros que coincidan con el filtro.</p>
                                                </div>
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
