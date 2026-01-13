"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, MapPin, Package, CheckCircle, Circle,
    Loader2, Clock, DollarSign, User
} from "lucide-react";
import { toast } from "sonner";

interface StopItem {
    id: string;
    item_name: string;
    quantity: number;
    notes: string | null;
    actual_cost: number;
    is_purchased: boolean;
}

interface Stop {
    id: string;
    stop_order: number;
    address: string;
    instructions: string | null;
    total_expense: number;
    items: StopItem[];
}

interface ServiceDetails {
    id: string;
    service_type: string;
    status: string;
    final_price: number;
    service_fee: number;
    total_shopping_cost: number;
    delivery_address: string;
    delivery_references: string | null;
    completed_at: string;
    client: {
        full_name: string;
        phone: string;
    };
}

const COMMISSION = 3;

export default function MandaditoDetailPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const serviceId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [service, setService] = useState<ServiceDetails | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                // Fetch service details
                const { data: serviceData, error: serviceError } = await supabase
                    .from("service_requests")
                    .select(`
                        *,
                        client:users!client_id(full_name, phone)
                    `)
                    .eq("id", serviceId)
                    .single();

                if (serviceError) throw serviceError;
                setService(serviceData);

                // Fetch stops with items
                const { data: stopsData, error: stopsError } = await supabase
                    .from("request_stops")
                    .select("*")
                    .eq("request_id", serviceId)
                    .order("stop_order", { ascending: true });

                if (stopsError) throw stopsError;

                // Fetch items for each stop
                const stopsWithItems = await Promise.all(
                    (stopsData || []).map(async (stop) => {
                        const { data: items } = await supabase
                            .from("stop_items")
                            .select("*")
                            .eq("stop_id", stop.id)
                            .order("item_order", { ascending: true });

                        return { ...stop, items: items || [] };
                    })
                );

                setStops(stopsWithItems);
            } catch (err: any) {
                console.error("Error fetching service details:", err);
                toast.error("Error al cargar los detalles");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [serviceId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!service) {
        return (
            <div className="p-4">
                <p className="text-center text-slate-500">Servicio no encontrado</p>
            </div>
        );
    }

    const driverEarnings = service.final_price - COMMISSION;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-orange-500 text-white p-4 sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                        className="text-white hover:bg-white/20"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-bold">Detalles del Servicio</h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-orange-100">
                    <Clock className="h-4 w-4" />
                    {new Date(service.completed_at).toLocaleDateString('es-MX', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Client Info */}
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-900">{service.client.full_name}</p>
                            <p className="text-sm text-slate-500">{service.client.phone}</p>
                        </div>
                    </div>
                </Card>

                {/* Delivery Address */}
                {service.delivery_address && (
                    <Card className="p-4">
                        <div className="flex gap-3">
                            <MapPin className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Dirección de entrega</p>
                                <p className="font-medium text-slate-900">{service.delivery_address}</p>
                                {service.delivery_references && (
                                    <p className="text-sm text-slate-600 mt-1">{service.delivery_references}</p>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Shopping List */}
                <div>
                    <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-500" />
                        Lista de Compras
                    </h2>
                    <div className="space-y-3">
                        {stops.map((stop, idx) => (
                            <Card key={stop.id} className="overflow-hidden">
                                <div className="bg-slate-100 p-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-900">{stop.address || `Parada ${idx + 1}`}</p>
                                        {stop.instructions && (
                                            <p className="text-xs text-slate-600 mt-0.5">{stop.instructions}</p>
                                        )}
                                    </div>
                                    <span className="text-orange-600 font-bold">
                                        ${stop.total_expense.toFixed(2)}
                                    </span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {stop.items.map((item) => (
                                        <div key={item.id} className="flex items-center gap-3">
                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-sm text-slate-900">
                                                    {item.item_name}
                                                    {item.quantity > 1 && (
                                                        <span className="text-slate-500"> (x{item.quantity})</span>
                                                    )}
                                                </p>
                                                {item.notes && (
                                                    <p className="text-xs text-slate-500">{item.notes}</p>
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700">
                                                ${item.actual_cost.toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Earnings Summary */}
                <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        Resumen de Ganancias
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Tarifa de servicio</span>
                            <span className="font-medium">${service.service_fee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Total de compras</span>
                            <span className="font-medium">${service.total_shopping_cost.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-slate-300 my-2"></div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-600">Total cobrado al cliente</span>
                            <span className="font-bold text-slate-900">${service.final_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-700">
                            <span>Comisión plataforma</span>
                            <span className="font-medium">-${COMMISSION.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-green-300 my-2"></div>
                        <div className="flex justify-between">
                            <span className="font-bold text-green-700 text-lg">Tu ganancia neta</span>
                            <span className="font-bold text-green-700 text-2xl">${driverEarnings.toFixed(2)}</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
