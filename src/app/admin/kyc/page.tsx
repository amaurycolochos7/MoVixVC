'use client';

// src/app/(admin)/kyc/page.tsx
// Admin dashboard for KYC verifications

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Check,
    X,
    ExternalLink,
    Loader2,
    RefreshCw,
    Users,
    Clock,
    CheckCircle2,
    XCircle,
    Trash2,
    Car,
    Phone,
    Mail,
    MessageCircle,
} from 'lucide-react';

interface KYCSubmission {
    id: string;
    user_id: string;
    drive_folder_url: string;
    created_at: string;
    user: {
        full_name: string;
        email: string;
        phone: string | null;
        role: string;
        kyc_submitted_at: string;
    };
    vehicle?: {
        brand: string;
        model: string;
        color: string;
        plate_number: string;
        taxi_number: string;
    } | null;
    kyc_rejection_reason?: string | null;
    kyc_reviewed_at?: string | null;
}

export default function AdminKYCPage() {
    const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ userId: string; name: string } | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ userId: string; name: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
    const [activeFilter, setActiveFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

    const supabase = createClient();

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Get drivers from users table based on active filter
            const { data: drivers, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .in('role', ['taxi', 'mandadito'])
                .eq('kyc_status', activeFilter)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;

            // Fetch vehicle data for all drivers
            const { data: vehiclesData } = await supabase
                .from('driver_vehicles')
                .select('user_id, brand, model, color, plate_number, taxi_number');

            // Map vehicle data by user_id
            const vehiclesMap = new Map(
                vehiclesData?.map(v => [v.user_id, v]) || []
            );

            // Fetch KYC submissions (optional - only if they uploaded documents)
            const { data: kycSubmissions } = await supabase
                .from('kyc_submissions')
                .select('user_id, drive_folder_url, created_at');

            const kycMap = new Map(
                kycSubmissions?.map(k => [k.user_id, k]) || []
            );

            // Transform drivers to match the interface
            const transformedSubmissions: KYCSubmission[] = (drivers || []).map(driver => ({
                id: driver.id,
                user_id: driver.id,
                drive_folder_url: kycMap.get(driver.id)?.drive_folder_url || '#',
                created_at: kycMap.get(driver.id)?.created_at || driver.created_at,
                user: {
                    full_name: driver.full_name,
                    email: driver.email,
                    phone: driver.phone,
                    role: driver.role,
                    kyc_submitted_at: driver.kyc_submitted_at || driver.created_at,
                },
                vehicle: vehiclesMap.get(driver.id) || null,
                kyc_rejection_reason: driver.kyc_rejection_reason, // Include rejection reason
                kyc_reviewed_at: driver.kyc_reviewed_at, // Include review date
            }));

            setSubmissions(transformedSubmissions);

            // Get stats (only fetch once, not affected by filter)
            const { data: statsData } = await supabase
                .from('users')
                .select('kyc_status')
                .in('role', ['taxi', 'mandadito']);

            const statusCounts = { pending: 0, approved: 0, rejected: 0 };
            statsData?.forEach(u => {
                if (u.kyc_status === 'pending') statusCounts.pending++;
                else if (u.kyc_status === 'approved') statusCounts.approved++;
                else if (u.kyc_status === 'rejected') statusCounts.rejected++;
            });
            setStats(statusCounts);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar datos');
        } finally {
            setIsLoading(false);
        }
    }, [supabase, activeFilter]);

    useEffect(() => {
        fetchSubmissions();
    }, [fetchSubmissions]);

    const handleApprove = async (userId: string) => {
        setProcessingId(userId);

        try {
            const { data: { user: admin } } = await supabase.auth.getUser();
            if (!admin) throw new Error('No autenticado');

            const { data, error } = await supabase.rpc('approve_kyc', {
                p_user_id: userId,
                p_admin_id: admin.id,
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            // Refresh list
            await fetchSubmissions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al aprobar');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async () => {
        if (!rejectModal) return;

        setProcessingId(rejectModal.userId);

        try {
            const { data: { user: admin } } = await supabase.auth.getUser();
            if (!admin) throw new Error('No autenticado');

            const { data, error } = await supabase.rpc('reject_kyc', {
                p_user_id: rejectModal.userId,
                p_admin_id: admin.id,
                p_reason: rejectReason || null,
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            setRejectModal(null);
            setRejectReason('');
            await fetchSubmissions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al rechazar');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeleteUser = async () => {
        if (!deleteModal) return;

        setProcessingId(deleteModal.userId);

        try {
            const { data: { user: admin } } = await supabase.auth.getUser();
            if (!admin) throw new Error('No autenticado');

            const { data, error } = await supabase.rpc('delete_user_permanently', {
                p_user_id: deleteModal.userId,
                p_admin_id: admin.id,
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            setDeleteModal(null);
            await fetchSubmissions();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Verificaciones KYC
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Gestiona las solicitudes de verificación de conductores
                    </p>
                </div>
                <button
                    onClick={fetchSubmissions}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-white hover:bg-gray-50 px-4 py-2.5 rounded-lg border-2 border-gray-200 hover:border-indigo-300 text-gray-700 transition-all shadow-sm hover:shadow"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span className="font-medium">Actualizar</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => setActiveFilter('pending')}
                    className={`text-left transition-all ${activeFilter === 'pending'
                        ? 'bg-gradient-to-br from-amber-50 to-white border-2 border-amber-400 shadow-lg scale-105'
                        : 'bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 shadow-sm hover:shadow-md hover:border-amber-300'
                        } rounded-xl p-6 cursor-pointer`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${activeFilter === 'pending' ? 'bg-amber-200' : 'bg-amber-100'}`}>
                            <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 font-medium">Pendientes</p>
                            <p className="text-3xl font-bold text-amber-600">{stats.pending}</p>
                        </div>
                    </div>
                    {activeFilter === 'pending' && (
                        <div className="mt-2 text-xs text-amber-700 font-medium">
                            ✓ Mostrando pendientes
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setActiveFilter('approved')}
                    className={`text-left transition-all ${activeFilter === 'approved'
                        ? 'bg-gradient-to-br from-green-50 to-white border-2 border-green-400 shadow-lg scale-105'
                        : 'bg-gradient-to-br from-green-50 to-white border-2 border-green-200 shadow-sm hover:shadow-md hover:border-green-300'
                        } rounded-xl p-6 cursor-pointer`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${activeFilter === 'approved' ? 'bg-green-200' : 'bg-green-100'}`}>
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 font-medium">Aprobados</p>
                            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
                        </div>
                    </div>
                    {activeFilter === 'approved' && (
                        <div className="mt-2 text-xs text-green-700 font-medium">
                            ✓ Mostrando aprobados
                        </div>
                    )}
                </button>

                <button
                    onClick={() => setActiveFilter('rejected')}
                    className={`text-left transition-all ${activeFilter === 'rejected'
                        ? 'bg-gradient-to-br from-red-50 to-white border-2 border-red-400 shadow-lg scale-105'
                        : 'bg-gradient-to-br from-red-50 to-white border-2 border-red-200 shadow-sm hover:shadow-md hover:border-red-300'
                        } rounded-xl p-6 cursor-pointer`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${activeFilter === 'rejected' ? 'bg-red-200' : 'bg-red-100'}`}>
                            <XCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 font-medium">Rechazados</p>
                            <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
                        </div>
                    </div>
                    {activeFilter === 'rejected' && (
                        <div className="mt-2 text-xs text-red-700 font-medium">
                            ✓ Mostrando rechazados
                        </div>
                    )}
                </button>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <p className="text-red-700 font-medium">{error}</p>
                </div>
            )}

            {/* Loading state */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20 bg-white rounded-xl border-2 border-gray-100">
                    <div className="text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">Cargando verificaciones...</p>
                    </div>
                </div>
            ) : submissions.length === 0 ? (
                /* Empty state */
                <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-16 text-center">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No hay verificaciones pendientes
                    </h3>
                    <p className="text-gray-600">
                        Todas las solicitudes de verificación han sido procesadas.
                    </p>
                </div>
            ) : (
                /* Submissions Grid */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {submissions.map((submission) => (
                        <div
                            key={submission.id}
                            className="bg-white rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all p-6"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-900 mb-1">
                                        {submission.user.full_name}
                                    </h3>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Mail className="w-4 h-4" />
                                            {submission.user.email}
                                        </div>
                                        {submission.user.phone && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Phone className="w-4 h-4" />
                                                {submission.user.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span
                                    className={`
                                        px-3 py-1 rounded-full text-xs font-semibold
                                        ${submission.user.role === 'taxi'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-purple-100 text-purple-700'
                                        }
                                    `}
                                >
                                    {submission.user.role === 'taxi' ? 'Taxi' : 'Mandadito'}
                                </span>
                            </div>

                            {/* Vehicle Info */}
                            {submission.vehicle && (
                                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Car className="w-4 h-4 text-gray-600" />
                                        <span className="font-semibold text-sm text-gray-700">Información del Vehículo</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                        <div className="text-gray-600">Modelo:</div>
                                        <div className="font-medium text-gray-900">{submission.vehicle.brand} {submission.vehicle.model}</div>
                                        <div className="text-gray-600">Color:</div>
                                        <div className="font-medium text-gray-900">{submission.vehicle.color}</div>
                                        <div className="text-gray-600">Placas:</div>
                                        <div className="font-medium text-gray-900">{submission.vehicle.plate_number}</div>
                                        <div className="text-gray-600">Taxi #:</div>
                                        <div className="font-medium text-gray-900">{submission.vehicle.taxi_number}</div>
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                                <div className="text-sm text-gray-500">
                                    Registrado: {formatDate(submission.created_at)}
                                </div>
                                {submission.drive_folder_url !== '#' ? (
                                    <a
                                        href={submission.drive_folder_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Ver documentos
                                    </a>
                                ) : (
                                    <span className="text-sm text-gray-400 italic">Sin documentos</span>
                                )}
                            </div>

                            {/* Rejection Reason (only for rejected) */}
                            {activeFilter === 'rejected' && submission.kyc_rejection_reason && (
                                <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 rounded">
                                    <p className="text-sm font-semibold text-red-900 mb-1">Motivo de rechazo:</p>
                                    <p className="text-sm text-red-700">{submission.kyc_rejection_reason}</p>
                                    {submission.kyc_reviewed_at && (
                                        <p className="text-xs text-red-600 mt-2">
                                            Rechazado: {formatDate(submission.kyc_reviewed_at)}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Approval Date + WhatsApp button (only for approved) */}
                            {activeFilter === 'approved' && submission.kyc_reviewed_at && (
                                <div className="mb-4 space-y-3">
                                    <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                                        <p className="text-sm text-green-700">
                                            ✓ Aprobado: {formatDate(submission.kyc_reviewed_at)}
                                        </p>
                                    </div>
                                    {/* WhatsApp Notification Button */}
                                    {submission.user.phone && (
                                        <button
                                            onClick={() => {
                                                const phone = submission.user.phone?.replace(/\D/g, '');
                                                const roleText = submission.user.role === 'taxi' ? 'chofer de taxi' : 'repartidor de Mandadito';
                                                const message = `¡Hola ${submission.user.full_name}! 🎉\n\nTu solicitud para trabajar como ${roleText} en MoVix ha sido APROBADA.\n\nYa puedes iniciar sesión en la app y empezar a recibir servicios.\n\n¡Bienvenido al equipo!`;
                                                window.open(`https://wa.me/52${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                            }}
                                            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            Notificar por WhatsApp
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Actions - Only show for pending */}
                            {activeFilter === 'pending' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApprove(submission.user_id)}
                                        disabled={processingId === submission.user_id}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                                    >
                                        {processingId === submission.user_id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Check className="w-4 h-4" />
                                        )}
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => setRejectModal({
                                            userId: submission.user_id,
                                            name: submission.user.full_name,
                                        })}
                                        disabled={processingId === submission.user_id}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                                    >
                                        <X className="w-4 h-4" />
                                        Rechazar
                                    </button>
                                    <button
                                        onClick={() => setDeleteModal({
                                            userId: submission.user_id,
                                            name: submission.user.full_name,
                                        })}
                                        disabled={processingId === submission.user_id}
                                        className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 px-3 py-2.5 rounded-lg transition-colors"
                                        title="Eliminar usuario permanentemente"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Rechazar verificación
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Rechazar la verificación de <strong>{rejectModal.name}</strong>.
                            Opcionalmente puedes agregar un motivo.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Motivo del rechazo (opcional)"
                            className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setRejectModal(null);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={processingId === rejectModal.userId}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                {processingId === rejectModal.userId ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <X className="w-4 h-4" />
                                )}
                                Confirmar rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <Trash2 className="w-6 h-6" />
                            <h3 className="text-xl font-bold">Eliminar Usuario</h3>
                        </div>
                        <p className="text-gray-600 text-sm mb-6">
                            ¿Estás seguro que deseas eliminar permanentemente a <strong>{deleteModal.name}</strong>?
                            <br /><br />
                            <span className="text-red-600 font-semibold">Esta acción no se puede deshacer.</span>
                            <br />
                            Se eliminarán todos sus datos, incluyendo vehículo y documentos.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteModal(null)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteUser}
                                disabled={processingId === deleteModal.userId}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                            >
                                {processingId === deleteModal.userId ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Eliminar permanentemente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
