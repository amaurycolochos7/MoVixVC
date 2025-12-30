'use client';

// src/components/kyc/AvailabilityToggle.tsx
// Toggle component for driver availability that respects KYC status

import { useState } from 'react';
import { useKYC } from '@/hooks/useKYC';
import { createClient } from '@/lib/supabase/client';
import { Power, Loader2, Lock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface AvailabilityToggleProps {
    initialAvailable?: boolean;
    onStatusChange?: (isAvailable: boolean) => void;
}

export function AvailabilityToggle({
    initialAvailable = false,
    onStatusChange,
}: AvailabilityToggleProps) {
    const { canToggleAvailable, status: kycStatus, isLoading: kycLoading } = useKYC();
    const [isAvailable, setIsAvailable] = useState(initialAvailable);
    const [isUpdating, setIsUpdating] = useState(false);

    const supabase = createClient();

    const handleToggle = async () => {
        if (!canToggleAvailable || isUpdating) return;

        setIsUpdating(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newStatus = !isAvailable;

            const { error } = await supabase
                .from('users')
                .update({ is_available: newStatus })
                .eq('id', user.id);

            if (error) {
                console.error('Failed to update availability:', error);
                return;
            }

            setIsAvailable(newStatus);
            onStatusChange?.(newStatus);
        } catch (err) {
            console.error('Error toggling availability:', err);
        } finally {
            setIsUpdating(false);
        }
    };

    if (kycLoading) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    // Show locked state if KYC not approved
    if (!canToggleAvailable) {
        return (
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <Lock className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                    <div>
                        <p className="font-medium text-gray-600 dark:text-gray-300">
                            Disponibilidad bloqueada
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {kycStatus === 'not_submitted' && 'Verifica tu identidad primero'}
                            {kycStatus === 'pending' && 'Esperando verificación'}
                            {kycStatus === 'rejected' && 'Verificación rechazada'}
                        </p>
                    </div>
                </div>
                <Link
                    href="/kyc"
                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
                >
                    {kycStatus === 'not_submitted' ? 'Verificar ahora' : 'Ver estado'}
                </Link>
            </div>
        );
    }

    return (
        <div
            className={`
        rounded-xl p-4 transition-all duration-300
        ${isAvailable
                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                    : 'bg-gray-100 dark:bg-gray-800 border-2 border-transparent'
                }
      `}
        >
            <button
                onClick={handleToggle}
                disabled={isUpdating}
                className="w-full flex items-center gap-4"
            >
                {/* Toggle indicator */}
                <div
                    className={`
            w-14 h-14 rounded-full flex items-center justify-center
            transition-all duration-300
            ${isAvailable
                            ? 'bg-green-500 shadow-lg shadow-green-500/30'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }
            ${isUpdating ? 'animate-pulse' : ''}
          `}
                >
                    {isUpdating ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                        <Power className={`w-6 h-6 ${isAvailable ? 'text-white' : 'text-gray-500'}`} />
                    )}
                </div>

                {/* Status text */}
                <div className="flex-1 text-left">
                    <p className={`font-semibold ${isAvailable ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300'}`}>
                        {isAvailable ? 'Disponible' : 'No disponible'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {isAvailable
                            ? 'Recibirás solicitudes de servicio'
                            : 'Toca para comenzar a recibir solicitudes'
                        }
                    </p>
                </div>

                {/* Toggle switch visual */}
                <div
                    className={`
            w-12 h-7 rounded-full p-1 transition-colors duration-300
            ${isAvailable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
          `}
                >
                    <div
                        className={`
              w-5 h-5 bg-white rounded-full shadow transition-transform duration-300
              ${isAvailable ? 'translate-x-5' : 'translate-x-0'}
            `}
                    />
                </div>
            </button>

            {isAvailable && (
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span>En línea - esperando solicitudes</span>
                    </div>
                </div>
            )}
        </div>
    );
}
