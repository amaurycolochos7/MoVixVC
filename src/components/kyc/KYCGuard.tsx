'use client';

// src/components/kyc/KYCGuard.tsx
// Guard component that blocks driver features when KYC is not approved

import { ReactNode } from 'react';
import { useKYC } from '@/hooks/useKYC';
import { Shield, Clock, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface KYCGuardProps {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Wraps content that should only be visible to KYC-approved drivers.
 * Shows a blocking banner if KYC is not approved.
 */
export function KYCGuard({ children, fallback }: KYCGuardProps) {
    const { status, isLoading, canOperate } = useKYC();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (canOperate) {
        return <>{children}</>;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    return <KYCBlockingBanner status={status} />;
}

/**
 * Banner shown when a driver cannot operate due to KYC status
 */
interface KYCBlockingBannerProps {
    status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
}

export function KYCBlockingBanner({ status }: KYCBlockingBannerProps) {
    const configs = {
        not_submitted: {
            icon: Shield,
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800',
            iconBg: 'bg-blue-100 dark:bg-blue-800',
            iconColor: 'text-blue-600 dark:text-blue-400',
            textColor: 'text-blue-800 dark:text-blue-200',
            subtextColor: 'text-blue-700 dark:text-blue-300',
            title: 'Verificación requerida',
            message: 'Debes completar la verificación de identidad antes de poder recibir solicitudes.',
            action: {
                label: 'Verificar ahora',
                href: '/kyc',
            },
        },
        pending: {
            icon: Clock,
            bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
            borderColor: 'border-yellow-200 dark:border-yellow-800',
            iconBg: 'bg-yellow-100 dark:bg-yellow-800',
            iconColor: 'text-yellow-600 dark:text-yellow-400',
            textColor: 'text-yellow-800 dark:text-yellow-200',
            subtextColor: 'text-yellow-700 dark:text-yellow-300',
            title: 'Cuenta en revisión',
            message: 'Estamos verificando tus documentos. Este proceso puede tomar de 24 a 48 horas.',
            action: null,
        },
        rejected: {
            icon: XCircle,
            bgColor: 'bg-red-50 dark:bg-red-900/20',
            borderColor: 'border-red-200 dark:border-red-800',
            iconBg: 'bg-red-100 dark:bg-red-800',
            iconColor: 'text-red-600 dark:text-red-400',
            textColor: 'text-red-800 dark:text-red-200',
            subtextColor: 'text-red-700 dark:text-red-300',
            title: 'Verificación rechazada',
            message: 'Tu verificación no fue aprobada. Puedes volver a enviar tus documentos.',
            action: {
                label: 'Ver detalles',
                href: '/kyc',
            },
        },
        approved: {
            icon: Shield,
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            iconBg: 'bg-green-100',
            iconColor: 'text-green-600',
            textColor: 'text-green-800',
            subtextColor: 'text-green-700',
            title: 'Verificado',
            message: '',
            action: null,
        },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
        <div className={`${config.bgColor} ${config.borderColor} border rounded-xl p-6`}>
            <div className="flex flex-col items-center text-center">
                <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mb-4`}>
                    <Icon className={`w-8 h-8 ${config.iconColor}`} />
                </div>
                <h3 className={`text-lg font-semibold ${config.textColor} mb-2`}>
                    {config.title}
                </h3>
                <p className={`${config.subtextColor} text-sm mb-4`}>
                    {config.message}
                </p>
                {config.action && (
                    <Link
                        href={config.action.href}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
                    >
                        {config.action.label}
                    </Link>
                )}
            </div>
        </div>
    );
}

/**
 * Small banner that can be shown at the top of screens
 */
export function KYCMiniBanner() {
    const { status, canOperate, isLoading } = useKYC();

    if (isLoading || canOperate) {
        return null;
    }

    const configs = {
        not_submitted: {
            bgColor: 'bg-blue-600',
            message: 'Completa tu verificación para empezar a recibir viajes',
            href: '/kyc',
        },
        pending: {
            bgColor: 'bg-yellow-600',
            message: 'Tu cuenta está siendo verificada...',
            href: '/kyc',
        },
        rejected: {
            bgColor: 'bg-red-600',
            message: 'Verificación rechazada - Toca para más información',
            href: '/kyc',
        },
    };

    const config = configs[status as keyof typeof configs];
    if (!config) return null;

    return (
        <Link
            href={config.href}
            className={`${config.bgColor} text-white text-sm py-2 px-4 flex items-center justify-center gap-2`}
        >
            <AlertTriangle className="w-4 h-4" />
            <span>{config.message}</span>
        </Link>
    );
}
