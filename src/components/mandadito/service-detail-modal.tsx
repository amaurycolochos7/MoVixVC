"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    X, MapPin, Package, CheckCircle, Clock, DollarSign, User, Loader2
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

interface ServiceDetailModalProps {
    serviceId: string;
    onClose: () => void;
}

const COMMISSION = 3;

export function ServiceDetailModal({ serviceId, onClose }: ServiceDetailModalProps) {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [service, setService] = useState<ServiceDetails | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
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

                const { data: stopsData, error: stopsError } = await supabase
                    .from("request_stops")
                    .select("*")
                    .eq("request_id", serviceId)
                    .order("stop_order", { ascending: true });

                if (stopsError) throw stopsError;

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

    // Prevent SSR hydration mismatch
    if (!mounted) return null;

    if (!service) return null;

    const driverEarnings = service.final_price - COMMISSION;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
                <div className="bg-white w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-orange-500 text-white p-4 sticky top-0 z-10 flex items-center justify-between">
                        <div className="flex-1">
                            <h2 className="font-bold text-lg">Detalles del Servicio</h2>
                            <div className="flex items-center gap-2 text-sm text-orange-100 mt-1">
                                <Clock className="h-3 w-3" />
                                {new Date(service.completed_at).toLocaleDateString('es-MX', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-[calc(90vh-80px)] sm:max-h-[calc(85vh-80px)]">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                            </div>
                        ) : (
                            <div className="p-4 space-y-4">
                                {/* Client Info */}
                                {service.client && (
                                    <div className="bg-slate-50 rounded-lg p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                                <User className="h-5 w-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{service.client.full_name}</p>
                                                <p className="text-sm text-slate-500">{service.client.phone}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Delivery Address */}
                                {service.delivery_address && (
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <div className="flex gap-3">
                                            <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs text-blue-700 font-medium mb-1">Dirección de entrega</p>
                                                <p className="font-medium text-slate-900">{service.delivery_address}</p>
                                                {service.delivery_references && (
                                                    <p className="text-sm text-slate-600 mt-1">{service.delivery_references}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Shopping List */}
                                <div>
                                    <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <Package className="h-5 w-5 text-orange-500" />
                                        Lista de Compras
                                    </h3>
                                    <div className="space-y-3">
                                        {stops.map((stop, idx) => (
                                            <div key={stop.id} className="border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-100 p-3 flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-slate-900 text-sm">{stop.address || `Parada ${idx + 1}`}</p>
                                                        {stop.instructions && (
                                                            <p className="text-xs text-slate-600 mt-0.5 truncate">{stop.instructions}</p>
                                                        )}
                                                    </div>
                                                    <span className="text-orange-600 font-bold text-sm">
                                                        ${(stop.total_expense || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="p-3 bg-white space-y-2">
                                                    {stop.items.map((item) => (
                                                        <div key={item.id} className="flex items-start gap-2">
                                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm text-slate-900">
                                                                    {item.item_name}
                                                                    {item.quantity > 1 && (
                                                                        <span className="text-slate-500"> (x{item.quantity})</span>
                                                                    )}
                                                                </p>
                                                                {item.notes && (
                                                                    <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>
                                                                )}
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-700 flex-shrink-0">
                                                                ${(item.actual_cost || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Earnings Summary - Redesigned */}
                                <div className="space-y-3">
                                    {/* What Client Paid */}
                                    <div className="bg-slate-100 rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                            Lo que pagó el cliente
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-700">Servicio de mandadito</span>
                                                <span className="font-semibold text-slate-900">${(service.service_fee || 28).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-700">Compras realizadas</span>
                                                <span className="font-semibold text-slate-900">${(service.total_shopping_cost || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="h-px bg-slate-300 my-1"></div>
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-900">Total cobrado</span>
                                                <span className="font-bold text-slate-900 text-lg">${(service.final_price || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Driver Earnings */}
                                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-300 rounded-lg p-4">
                                        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-3">
                                            Tu ganancia
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-green-800">Del servicio</span>
                                                <span className="font-semibold text-green-900">${((service.service_fee || 28) - COMMISSION).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-amber-700">
                                                <span>Comisión plataforma</span>
                                                <span className="font-medium">-${COMMISSION.toFixed(2)}</span>
                                            </div>
                                            <div className="h-px bg-green-400 my-1"></div>
                                            <div className="flex justify-between items-center bg-green-600 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                                                <span className="font-bold text-white text-lg">GANANCIA NETA</span>
                                                <span className="font-bold text-white text-2xl">${driverEarnings.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
