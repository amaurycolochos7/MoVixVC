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
    Search,
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
}

export default function AdminKYCPage() {
    const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ userId: string; name: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

    const supabase = createClient();

    const fetchSubmissions = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Get pending KYC submissions with user data
            const { data, error: fetchError } = await supabase
                .from('kyc_submissions')
                .select(`
          id,
          user_id,
          drive_folder_url,
          created_at,
          user:users!user_id (
            full_name,
            email,
            phone,
            role,
            kyc_submitted_at
          )
        `)
                .order('created_at', { ascending: true });

            if (fetchError) throw fetchError;

            // Filter to only show pending submissions by joining with users table
            const { data: pendingUsers } = await supabase
                .from('users')
                .select('id')
                .eq('kyc_status', 'pending');

            const pendingUserIds = new Set(pendingUsers?.map(u => u.id) || []);
            const pendingSubmissions = (data as unknown as KYCSubmission[])
                ?.filter(s => pendingUserIds.has(s.user_id)) || [];

            setSubmissions(pendingSubmissions);

            // Get stats
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
    }, [supabase]);

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
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Verificaciones KYC
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                                Gestiona las solicitudes de verificación de conductores
                            </p>
                        </div>
                        <button
                            onClick={fetchSubmissions}
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                    </div>
                </div>
            </header>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatCard
                        icon={<Clock className="w-5 h-5" />}
                        label="Pendientes"
                        value={stats.pending}
                        color="yellow"
                    />
                    <StatCard
                        icon={<CheckCircle2 className="w-5 h-5" />}
                        label="Aprobados"
                        value={stats.approved}
                        color="green"
                    />
                    <StatCard
                        icon={<XCircle className="w-5 h-5" />}
                        label="Rechazados"
                        value={stats.rejected}
                        color="red"
                    />
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <p className="text-red-700 dark:text-red-300">{error}</p>
                    </div>
                )}

                {/* Loading state */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : submissions.length === 0 ? (
                    /* Empty state */
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            No hay verificaciones pendientes
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Todas las solicitudes de verificación han sido procesadas.
                        </p>
                    </div>
                ) : (
                    /* Submissions list */
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Conductor
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Enviado
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Documentos
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {submissions.map((submission) => (
                                    <tr key={submission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {submission.user.full_name}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {submission.user.email}
                                                </div>
                                                {submission.user.phone && (
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {submission.user.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`
                          inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${submission.user.role === 'taxi'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                                    }
                        `}
                                            >
                                                {submission.user.role === 'taxi' ? 'Taxi' : 'Mandadito'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(submission.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <a
                                                href={submission.drive_folder_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Ver en Drive
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleApprove(submission.user_id)}
                                                    disabled={processingId === submission.user_id}
                                                    className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                                                    className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Rechazar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Reject Modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Rechazar verificación
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                            Rechazar la verificación de <strong>{rejectModal.name}</strong>.
                            Opcionalmente puedes agregar un motivo.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Motivo del rechazo (opcional)"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setRejectModal(null);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={processingId === rejectModal.userId}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
        </div>
    );
}

// Stat card component
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: 'yellow' | 'green' | 'red';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
    const colors = {
        yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
        green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
        red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colors[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
            </div>
        </div>
    );
}
