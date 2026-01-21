'use client';

// src/components/kyc/KYCStatus.tsx
// Component to display current KYC verification status

import { useKYC, KYCStatus as KYCStatusType } from '@/hooks/useKYC';
import { KYCForm } from './KYCForm';
import {
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    FileText,
    Loader2,
    RefreshCw,
    MessageCircle,
} from 'lucide-react';

export function KYCStatus() {
    const {
        status,
        rejectionReason,
        submittedAt,
        reviewedAt,
        isLoading,
        error,
        resetForResubmit,
    } = useKYC();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {status === 'not_submitted' && <KYCForm />}
            {status === 'pending' && <PendingStatus submittedAt={submittedAt} />}
            {status === 'approved' && <ApprovedStatus reviewedAt={reviewedAt} />}
            {status === 'rejected' && (
                <RejectedStatus
                    reason={rejectionReason}
                    reviewedAt={reviewedAt}
                    onRetry={resetForResubmit}
                />
            )}
        </div>
    );
}

// Pending status component
function PendingStatus({ submittedAt }: { submittedAt: string | null }) {
    const formattedDate = submittedAt
        ? new Date(submittedAt).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null;

    // Check if more than 24 hours have passed
    const moreThan24Hours = submittedAt
        ? (Date.now() - new Date(submittedAt).getTime()) > 24 * 60 * 60 * 1000
        : false;

    const handleWhatsAppSupport = () => {
        const phone = '5219618720544';
        const message = encodeURIComponent(
            '¡Hola! Soy conductor de MoVix. Han pasado más de 24 horas desde que envié mis documentos para verificación y aún no he recibido respuesta. ¿Podrían revisar mi solicitud?'
        );
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };

    return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Verificación en proceso
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm mb-4">
                Estamos revisando tus documentos. Este proceso puede tomar de 24 a 48 horas.
            </p>
            {formattedDate && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Documentos enviados el {formattedDate}
                </p>
            )}
            <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        No puedes activar &quot;Disponible&quot; hasta ser verificado
                    </span>
                </div>
            </div>

            {/* WhatsApp support button if more than 24 hours */}
            {moreThan24Hours && (
                <div className="mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-700">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                        ¿Han pasado más de 24 horas? Contáctanos para revisar tu solicitud.
                    </p>
                    <button
                        onClick={handleWhatsAppSupport}
                        className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Contactar a Soporte
                    </button>
                </div>
            )}
        </div>
    );
}

// Approved status component
function ApprovedStatus({ reviewedAt }: { reviewedAt: string | null }) {
    const formattedDate = reviewedAt
        ? new Date(reviewedAt).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : null;

    return (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                ¡Cuenta verificada!
            </h3>
            <p className="text-green-700 dark:text-green-300 text-sm mb-4">
                Tu identidad ha sido verificada exitosamente. Ya puedes comenzar a recibir solicitudes.
            </p>
            {formattedDate && (
                <p className="text-xs text-green-600 dark:text-green-400">
                    Verificado el {formattedDate}
                </p>
            )}
            <div className="mt-6 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        Activa &quot;Disponible&quot; para empezar a recibir viajes
                    </span>
                </div>
            </div>
        </div>
    );
}

// Rejected status component
interface RejectedStatusProps {
    reason: string | null;
    reviewedAt: string | null;
    onRetry: () => Promise<void>;
}

function RejectedStatus({ reason, reviewedAt, onRetry }: RejectedStatusProps) {
    const [isResetting, setIsResetting] = useState(false);

    const handleRetry = async () => {
        setIsResetting(true);
        await onRetry();
        setIsResetting(false);
    };

    const formattedDate = reviewedAt
        ? new Date(reviewedAt).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : null;

    return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Verificación rechazada
            </h3>
            <p className="text-red-700 dark:text-red-300 text-sm mb-4">
                Tu solicitud de verificación no fue aprobada. Puedes volver a intentarlo.
            </p>

            {reason && (
                <div className="bg-red-100 dark:bg-red-900/30 rounded-lg p-4 mb-4 text-left">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
                        Motivo del rechazo:
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300">{reason}</p>
                </div>
            )}

            {formattedDate && (
                <p className="text-xs text-red-500 dark:text-red-400 mb-4">
                    Revisado el {formattedDate}
                </p>
            )}

            <button
                onClick={handleRetry}
                disabled={isResetting}
                className={`
          w-full py-3 px-6 rounded-xl font-semibold text-white
          flex items-center justify-center gap-2
          transition-all duration-200
          ${isResetting
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
                    }
        `}
            >
                {isResetting ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Preparando...
                    </>
                ) : (
                    <>
                        <RefreshCw className="w-5 h-5" />
                        Volver a enviar documentos
                    </>
                )}
            </button>
        </div>
    );
}

// Missing import for useState in RejectedStatus
import { useState } from 'react';
