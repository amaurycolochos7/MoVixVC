"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AccountPendingProps {
    userName?: string;
    reason?: string;
    isRejected?: boolean;
}

const ADMIN_WHATSAPP = "529618720544"; // +52 961 872 0544

export function AccountPendingMessage({ userName, reason, isRejected }: AccountPendingProps) {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const handleWhatsApp = () => {
        const message = isRejected
            ? `Hola, mi solicitud como conductor fue rechazada. Mi nombre es ${userName || 'usuario'}. ¿Podrían ayudarme?`
            : `Hola, mi solicitud como conductor lleva más de 48 horas en revisión. Mi nombre es ${userName || 'usuario'}. ¿Podrían revisar mi caso?`;
        window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
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

                    {/* Info box - WhatsApp notification */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                        <div className="flex gap-3">
                            <MessageCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-green-900">
                                <p className="font-medium mb-1">Te contactaremos por WhatsApp</p>
                                <p className="text-green-700">
                                    Recibirás un mensaje de WhatsApp cuando tu cuenta sea aprobada.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* WhatsApp contact button */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800 mb-3">
                            ¿Han pasado más de 48 horas? Contáctanos:
                        </p>
                        <Button
                            onClick={handleWhatsApp}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Contactar por WhatsApp
                        </Button>
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
                </CardContent>
            </Card>
        </div>
    );
}
