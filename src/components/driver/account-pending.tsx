"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AccountPendingProps {
    userName?: string;
    reason?: string;
    isRejected?: boolean;
}

export function AccountPendingMessage({ userName, reason, isRejected }: AccountPendingProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-amber-50 to-surface">
            <Card className="max-w-md w-full shadow-lg">
                <CardContent className="pt-8 pb-6 text-center space-y-6">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="relative">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isRejected ? 'bg-red-100' : 'bg-amber-100'
                                }`}>
                                {isRejected ? (
                                    <AlertTriangle className="w-10 h-10 text-red-600" />
                                ) : (
                                    <Clock className="w-10 h-10 text-amber-600" />
                                )}
                            </div>
                            <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${isRejected ? 'bg-red-500' : 'bg-amber-500'
                                }`}>
                                <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <h2 className={`text-2xl font-bold ${isRejected ? 'text-red-900' : 'text-gray-900'}`}>
                            {isRejected ? 'Solicitud Rechazada' : 'Cuenta en Revisión'}
                        </h2>
                        {userName && (
                            <p className="text-sm text-gray-600">
                                Hola {userName}
                            </p>
                        )}
                    </div>

                    {/* Message */}
                    <div className="space-y-3 text-gray-600">
                        {isRejected ? (
                            <>
                                <p className="leading-relaxed">
                                    Tu solicitud para trabajar como conductor ha sido rechazada por la administración.
                                </p>
                                {reason && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                                        <p className="text-sm font-medium text-red-900 mb-1">Motivo:</p>
                                        <p className="text-sm text-red-700">{reason}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="leading-relaxed">
                                    Tu solicitud para trabajar como conductor está siendo revisada por nuestro equipo de administración.
                                </p>
                                <p className="text-sm">
                                    Este proceso puede tomar hasta <strong>24-48 horas</strong>.
                                </p>
                            </>
                        )}
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                        <div className="flex gap-3">
                            <Mail className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-900">
                                <p className="font-medium mb-1">Te notificaremos por email</p>
                                <p className="text-blue-700">
                                    Recibirás un correo cuando tu cuenta sea aprobada y puedas empezar a trabajar.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action */}
                    <div className="pt-2">
                        <Button
                            onClick={handleSignOut}
                            variant="outline"
                            className="w-full"
                        >
                            Cerrar Sesión
                        </Button>
                    </div>

                    {/* Help text */}
                    <p className="text-xs text-gray-500">
                        ¿Tienes dudas? Contacta a soporte
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
