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
import { Loader2, Car, Package, MapPin, Calendar, User } from "lucide-react";

interface ServiceData {
    id: string;
    service_type: "taxi" | "mandadito";
    status: string;
    origin_address: string;
    destination_address: string | null;
    final_price: number | null;
    estimated_price: number | null;
    created_at: string;
    client: { full_name: string } | null;
    driver: { full_name: string } | null;
}

export default function AdminServiciosPage() {
    const [services, setServices] = useState<ServiceData[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const fetchServices = async () => {
            try {
                // Fetch services with client and driver details
                const { data, error } = await supabase
                    .from("service_requests")
                    .select(`
                        id,
                        service_type,
                        status,
                        origin_address,
                        destination_address,
                        final_price,
                        estimated_price,
                        created_at,
                        client:users!client_id(full_name),
                        driver:users!assigned_driver_id(full_name)
                    `)
                    .order("created_at", { ascending: false });

                if (error) throw error;
                // @ts-ignore - Supabase types join handling
                setServices(data || []);
            } catch (error) {
                console.error("Error fetching services:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, [supabase]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <Badge className="bg-green-600 hover:bg-green-700">Completado</Badge>;
            case "in_progress":
                return <Badge className="bg-blue-600 hover:bg-blue-700 animate-pulse">En Curso</Badge>;
            case "assigned":
                return <Badge className="bg-indigo-500 hover:bg-indigo-600">Asignado</Badge>;
            case "cancelled":
                return <Badge variant="destructive">Cancelado</Badge>;
            case "pending":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Buscando</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Gestión de Servicios</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Servicios ({services.length})</CardTitle>
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
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Cliente / Conductor</TableHead>
                                        <TableHead>Ruta</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead>Fecha</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {services.map((service) => (
                                        <TableRow key={service.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {service.service_type === "taxi" ? (
                                                        <Car className="h-4 w-4 text-blue-600" />
                                                    ) : (
                                                        <Package className="h-4 w-4 text-orange-500" />
                                                    )}
                                                    <span className="capitalize font-medium">{service.service_type}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(service.status)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <User className="h-3 w-3 text-gray-500" />
                                                        <span className="font-medium">
                                                            {service.client?.full_name || "Desconocido"}
                                                        </span>
                                                    </div>
                                                    {service.driver && (
                                                        <div className="flex items-center gap-1 text-muted-foreground mt-1">
                                                            <Car className="h-3 w-3" />
                                                            <span>{service.driver.full_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-sm max-w-[200px]">
                                                    <div className="flex items-center gap-1 truncate" title={service.origin_address}>
                                                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                                        <span className="truncate">{service.origin_address}</span>
                                                    </div>
                                                    {service.destination_address && (
                                                        <div className="flex items-center gap-1 truncate mt-1" title={service.destination_address}>
                                                            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                                            <span className="truncate">{service.destination_address}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-bold">
                                                    ${(service.final_price || service.estimated_price || 0).toFixed(2)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(service.created_at), "dd MMM HH:mm", { locale: es })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {services.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center p-8 text-muted-foreground">
                                                No se encontraron servicios registrados.
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
