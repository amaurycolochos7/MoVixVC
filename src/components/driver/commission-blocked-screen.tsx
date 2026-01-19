"use client";

import { Phone, AlertTriangle, Wallet, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CommissionBlockedScreenProps {
    amountOwed: number;
    dueDate?: string;
    supportPhone?: string;
}

// Número de soporte
const SUPPORT_PHONE = "9651001234";

export function CommissionBlockedScreen({
    amountOwed,
    dueDate,
    supportPhone = SUPPORT_PHONE
}: CommissionBlockedScreenProps) {
    const handleCall = () => {
        window.location.href = `tel:${supportPhone}`;
    };

    const handleWhatsApp = () => {
        const message = encodeURIComponent(
            `Hola, soy conductor de MoVix. Quiero pagar mi comisión pendiente de $${amountOwed.toFixed(2)}. ¿Cómo puedo realizar el pago?`
        );
        window.open(`https://wa.me/52${supportPhone}?text=${message}`, '_blank');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-red-500 to-red-600 flex flex-col items-center justify-center p-6 text-white">
            {/* Icon */}
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="h-12 w-12 text-white" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center mb-2">
                Cuenta Suspendida
            </h1>

            <p className="text-red-100 text-center mb-8 max-w-xs">
                Tu cuenta ha sido suspendida por comisiones pendientes de pago.
            </p>

            {/* Amount Card */}
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mb-8 text-center">
                <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
                    <Wallet className="h-5 w-5" />
                    <span className="text-sm font-medium">Deuda pendiente</span>
                </div>
                <p className="text-4xl font-black text-gray-900 mb-2">
                    ${amountOwed.toFixed(2)}
                </p>
                {dueDate && (
                    <p className="text-sm text-gray-500">
                        Vencido desde {dueDate}
                    </p>
                )}
            </div>

            {/* Instructions */}
            <div className="bg-white/10 rounded-xl p-4 mb-8 w-full max-w-sm">
                <p className="text-sm text-center text-red-100">
                    Para reactivar tu cuenta, contacta a soporte y realiza el pago de tu comisión.
                </p>
            </div>

            {/* Action Buttons */}
            <div className="w-full max-w-sm space-y-3">
                <Button
                    onClick={handleWhatsApp}
                    className="w-full h-14 bg-green-500 hover:bg-green-600 text-lg font-semibold"
                >
                    <MessageCircle className="h-5 w-5 mr-2" />
                    Contactar por WhatsApp
                </Button>

                <Button
                    onClick={handleCall}
                    variant="outline"
                    className="w-full h-14 bg-white/10 border-white/30 text-white hover:bg-white/20 text-lg"
                >
                    <Phone className="h-5 w-5 mr-2" />
                    Llamar a Soporte
                </Button>
            </div>

            {/* Support Number */}
            <p className="mt-6 text-red-200 text-sm">
                Soporte: {supportPhone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
            </p>
        </div>
    );
}
