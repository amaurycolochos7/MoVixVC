"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import {
    Loader2,
    Package,
    Car,
    CheckCircle,
    AlertTriangle,
    Clock,
    Phone,
    DollarSign,
    Calendar,
    ChevronRight,
    Search,
    Ban,
    LockOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface CommissionPeriod {
    id: string;
    driver_id: string;
    service_type: 'mandadito' | 'taxi';
    period_start: string;
    period_end: string;
    completed_services: number;
    commission_amount: number;
    status: 'pending' | 'paid' | 'overdue' | 'no_services';
    paid_at: string | null;
    driver: {
        full_name: string;
        phone: string;
        email: string;
        commission_status: string;
    };
}

interface DriverSummary {
    driver_id: string;
    full_name: string;
    phone: string;
    email: string;
    commission_status: string;
    total_services: number;
    total_commission: number;
    periods: CommissionPeriod[];
}

const COMMISSION_RATES = {
    mandadito: 3,
    taxi: 5
};

export default function AdminComisionesPage() {
    const supabase = createClient();
    const { profile, loading: authLoading } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'mandadito' | 'taxi'>('mandadito');
    const [periods, setPeriods] = useState<CommissionPeriod[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [weekFilter, setWeekFilter] = useState<'current' | 'previous' | 'all'>('current');

    // Auth check
    useEffect(() => {
        if (!authLoading && (!profile || profile.role !== 'admin')) {
            router.push('/');
        }
    }, [profile, authLoading, router]);

    // Fetch commission periods
    useEffect(() => {
        const fetchPeriods = async () => {
            setLoading(true);
            try {
                // First, let's calculate current week's commissions from service_requests
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
                startOfWeek.setHours(0, 0, 0, 0);

                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 6); // Sunday
                endOfWeek.setHours(23, 59, 59, 999);

                let periodStart: Date, periodEnd: Date;

                if (weekFilter === 'current') {
                    periodStart = startOfWeek;
                    periodEnd = endOfWeek;
                } else if (weekFilter === 'previous') {
                    periodStart = new Date(startOfWeek);
                    periodStart.setDate(periodStart.getDate() - 7);
                    periodEnd = new Date(endOfWeek);
                    periodEnd.setDate(periodEnd.getDate() - 7);
                } else {
                    // All time - last 30 days
                    periodStart = new Date(now);
                    periodStart.setDate(periodStart.getDate() - 30);
                    periodEnd = now;
                }

                // Get completed services grouped by driver
                const { data: services, error } = await supabase
                    .from("service_requests")
                    .select(`
                        id,
                        assigned_driver_id,
                        service_type,
                        completed_at,
                        status,
                        driver:users!assigned_driver_id(
                            id,
                            full_name,
                            phone,
                            email,
                            commission_status
                        )
                    `)
                    .eq("status", "completed")
                    .eq("service_type", activeTab)
                    .gte("completed_at", periodStart.toISOString())
                    .lte("completed_at", periodEnd.toISOString())
                    .not("assigned_driver_id", "is", null);

                if (error) throw error;

                // Group by driver
                const driverMap = new Map<string, DriverSummary>();

                (services || []).forEach((service: any) => {
                    if (!service.driver) return;

                    const driverId = service.assigned_driver_id;
                    if (!driverMap.has(driverId)) {
                        driverMap.set(driverId, {
                            driver_id: driverId,
                            full_name: service.driver.full_name || 'Sin nombre',
                            phone: service.driver.phone || '',
                            email: service.driver.email || '',
                            commission_status: service.driver.commission_status || 'ok',
                            total_services: 0,
                            total_commission: 0,
                            periods: []
                        });
                    }

                    const driver = driverMap.get(driverId)!;
                    driver.total_services++;
                    driver.total_commission = driver.total_services * COMMISSION_RATES[activeTab];
                });

                // Convert to array and create period-like structure
                const driversWithCommissions: CommissionPeriod[] = Array.from(driverMap.values())
                    .filter(d => d.total_services > 0)
                    .map(driver => ({
                        id: `${driver.driver_id}-${periodStart.toISOString()}`,
                        driver_id: driver.driver_id,
                        service_type: activeTab as 'mandadito' | 'taxi',
                        period_start: periodStart.toISOString(),
                        period_end: periodEnd.toISOString(),
                        completed_services: driver.total_services,
                        commission_amount: driver.total_commission,
                        status: (driver.commission_status === 'blocked' ? 'overdue' : 'pending') as 'pending' | 'paid' | 'overdue' | 'no_services',
                        paid_at: null,
                        driver: {
                            full_name: driver.full_name,
                            phone: driver.phone,
                            email: driver.email,
                            commission_status: driver.commission_status
                        }
                    }));

                // Check existing paid periods
                const { data: paidPeriods } = await supabase
                    .from("driver_commission_periods")
                    .select("driver_id, status, paid_at")
                    .eq("service_type", activeTab)
                    .gte("period_start", periodStart.toISOString())
                    .lte("period_end", periodEnd.toISOString());

                // Merge paid status
                const mergedPeriods: CommissionPeriod[] = driversWithCommissions.map(period => {
                    const paidPeriod = paidPeriods?.find(p => p.driver_id === period.driver_id);
                    if (paidPeriod?.status === 'paid') {
                        return { ...period, status: 'paid' as const, paid_at: paidPeriod.paid_at };
                    }
                    return period;
                });

                setPeriods(mergedPeriods);
            } catch (err) {
                console.error("Error fetching commissions:", err);
                toast.error("Error al cargar comisiones");
            } finally {
                setLoading(false);
            }
        };

        if (profile?.role === 'admin') {
            fetchPeriods();
        }
    }, [activeTab, weekFilter, profile]);

    const handleMarkPaid = async (period: CommissionPeriod) => {
        if (!profile) return;

        setProcessingId(period.id);
        try {
            // Upsert commission period as paid
            const { error } = await supabase
                .from("driver_commission_periods")
                .upsert({
                    driver_id: period.driver_id,
                    service_type: period.service_type,
                    period_start: period.period_start,
                    period_end: period.period_end,
                    completed_services: period.completed_services,
                    commission_amount: period.commission_amount,
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    marked_paid_by: profile.id
                }, {
                    onConflict: 'driver_id,service_type,period_start'
                });

            if (error) throw error;

            // Unblock driver if they were blocked
            await supabase
                .from("users")
                .update({ commission_status: 'ok' })
                .eq("id", period.driver_id);

            // Update local state
            setPeriods(prev => prev.map(p =>
                p.id === period.id
                    ? { ...p, status: 'paid', paid_at: new Date().toISOString() }
                    : p
            ));

            toast.success(`Pago registrado para ${period.driver.full_name}`);
        } catch (err) {
            console.error("Error marking paid:", err);
            toast.error("Error al registrar pago");
        } finally {
            setProcessingId(null);
        }
    };

    const handleToggleBlock = async (period: CommissionPeriod) => {
        setProcessingId(`block-${period.id}`);
        try {
            const isCurrentlyBlocked = period.driver.commission_status === 'blocked';
            const newStatus = isCurrentlyBlocked ? 'ok' : 'blocked';

            const { error } = await supabase
                .from("users")
                .update({ commission_status: newStatus })
                .eq("id", period.driver_id);

            if (error) throw error;

            // Update local state
            setPeriods(prev => prev.map(p =>
                p.driver_id === period.driver_id
                    ? {
                        ...p,
                        status: newStatus === 'blocked' ? 'overdue' as const : p.status,
                        driver: { ...p.driver, commission_status: newStatus }
                    }
                    : p
            ));

            toast.success(
                isCurrentlyBlocked
                    ? `${period.driver.full_name} desbloqueado`
                    : `${period.driver.full_name} bloqueado por falta de pago`
            );
        } catch (err) {
            console.error("Error toggling block:", err);
            toast.error("Error al cambiar estado");
        } finally {
            setProcessingId(null);
        }
    };

    const filteredPeriods = periods.filter(p =>
        p.driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.driver.phone.includes(searchQuery)
    );

    const totalCommission = filteredPeriods.reduce((sum, p) =>
        p.status !== 'paid' ? sum + p.commission_amount : sum, 0
    );
    const totalPaid = filteredPeriods.reduce((sum, p) =>
        p.status === 'paid' ? sum + p.commission_amount : sum, 0
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Pagado</span>;
            case 'overdue':
                return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Vencido</span>;
            default:
                return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pendiente</span>;
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
                <h1 className="text-xl font-bold text-gray-900">Comisiones</h1>
                <p className="text-sm text-gray-500">Gestión de pagos de conductores</p>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4">
                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('mandadito')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'mandadito'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Package className="h-4 w-4" />
                        Mandaditos
                    </button>
                    <button
                        onClick={() => setActiveTab('taxi')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'taxi'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Car className="h-4 w-4" />
                        Taxis
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="px-4 py-4 grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-amber-600 mb-2">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs font-medium">Por cobrar</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">${totalCommission.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-green-600 mb-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-medium">Cobrado</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">${totalPaid.toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="px-4 pb-4 space-y-3">
                {/* Week Filter */}
                <div className="flex gap-2">
                    {[
                        { value: 'current', label: 'Esta semana' },
                        { value: 'previous', label: 'Semana pasada' },
                        { value: 'all', label: 'Últimos 30 días' }
                    ].map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => setWeekFilter(filter.value as any)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${weekFilter === filter.value
                                ? 'bg-gray-900 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar conductor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Drivers List */}
            <div className="px-4 pb-20">
                {filteredPeriods.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                        <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No hay comisiones en este período</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden divide-y divide-gray-50">
                        {filteredPeriods.map((period) => (
                            <div key={period.id} className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {period.driver.full_name}
                                            </h3>
                                            {getStatusBadge(period.status)}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                            {period.driver.phone && (
                                                <a
                                                    href={`tel:${period.driver.phone}`}
                                                    className="flex items-center gap-1 hover:text-gray-700"
                                                >
                                                    <Phone className="h-3 w-3" />
                                                    {period.driver.phone}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xl font-bold ${period.status === 'paid' ? 'text-green-600' : 'text-amber-600'
                                            }`}>
                                            ${period.commission_amount.toFixed(2)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {period.completed_services} servicios × ${COMMISSION_RATES[activeTab]}
                                        </p>
                                    </div>
                                </div>

                                {period.status !== 'paid' && (
                                    <Button
                                        onClick={() => handleMarkPaid(period)}
                                        disabled={processingId === period.id}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                        {processingId === period.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                        )}
                                        Marcar como Pagado
                                    </Button>
                                )}

                                {period.status === 'paid' && period.paid_at && (
                                    <p className="text-xs text-green-600 text-center">
                                        ✓ Pagado el {new Date(period.paid_at).toLocaleDateString('es-MX', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                )}

                                {/* Manual Block/Unblock Button */}
                                <Button
                                    onClick={() => handleToggleBlock(period)}
                                    disabled={processingId === `block-${period.id}`}
                                    variant="outline"
                                    size="sm"
                                    className={`w-full mt-2 ${period.driver.commission_status === 'blocked'
                                            ? 'border-green-300 text-green-600 hover:bg-green-50'
                                            : 'border-red-300 text-red-600 hover:bg-red-50'
                                        }`}
                                >
                                    {processingId === `block-${period.id}` ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : period.driver.commission_status === 'blocked' ? (
                                        <LockOpen className="h-4 w-4 mr-2" />
                                    ) : (
                                        <Ban className="h-4 w-4 mr-2" />
                                    )}
                                    {period.driver.commission_status === 'blocked'
                                        ? 'Desbloquear'
                                        : 'Bloquear por falta de pago'
                                    }
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
