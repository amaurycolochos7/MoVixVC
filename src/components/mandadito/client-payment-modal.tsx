"use client";

import { useState } from "react";
import { X, Banknote, CreditCard, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DriverBankInfo {
    bank_clabe?: string;
    bank_card_number?: string;
    bank_holder_name?: string;
    bank_name?: string;
}

interface ClientPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    driverName: string;
    driverBankInfo: DriverBankInfo;
    amount: number;
}

export function ClientPaymentModal({
    isOpen,
    onClose,
    driverName,
    driverBankInfo,
    amount
}: ClientPaymentModalProps) {
    const [selectedMethod, setSelectedMethod] = useState<'cash' | 'transfer' | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        toast.success(`${label} copiado`);
        setTimeout(() => setCopied(null), 2000);
    };

    const formatClabe = (clabe: string) => {
        return clabe.replace(/(\d{4})/g, '$1 ').trim();
    };

    const formatCardNumber = (card: string) => {
        return card.replace(/(\d{4})/g, '$1 ').trim();
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-x-0 bottom-0 z-50">
                <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white">
                        <h2 className="text-lg font-bold text-gray-900">Método de Pago</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Amount to pay */}
                        <div className="bg-orange-50 rounded-xl p-4 text-center">
                            <p className="text-sm text-orange-600">Total a pagar</p>
                            <p className="text-3xl font-bold text-orange-600">${amount.toFixed(2)}</p>
                        </div>

                        {/* Payment Methods */}
                        <div className="space-y-3">
                            {/* Cash Option */}
                            <button
                                onClick={() => setSelectedMethod('cash')}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedMethod === 'cash'
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedMethod === 'cash' ? 'bg-green-500' : 'bg-gray-100'
                                    }`}>
                                    <Banknote className={`h-6 w-6 ${selectedMethod === 'cash' ? 'text-white' : 'text-gray-500'
                                        }`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold text-gray-900">Efectivo</p>
                                    <p className="text-sm text-gray-500">Pagar al recibir el pedido</p>
                                </div>
                                {selectedMethod === 'cash' && (
                                    <Check className="h-6 w-6 text-green-500" />
                                )}
                            </button>

                            {/* Transfer Option */}
                            <button
                                onClick={() => setSelectedMethod('transfer')}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${selectedMethod === 'transfer'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedMethod === 'transfer' ? 'bg-blue-500' : 'bg-gray-100'
                                    }`}>
                                    <CreditCard className={`h-6 w-6 ${selectedMethod === 'transfer' ? 'text-white' : 'text-gray-500'
                                        }`} />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold text-gray-900">Transferencia</p>
                                    <p className="text-sm text-gray-500">Envía antes de que llegue</p>
                                </div>
                                {selectedMethod === 'transfer' && (
                                    <Check className="h-6 w-6 text-blue-500" />
                                )}
                            </button>
                        </div>

                        {/* Transfer Details (shown when transfer is selected) */}
                        {selectedMethod === 'transfer' && (
                            <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                                <h3 className="font-semibold text-blue-900">
                                    Datos de {driverName}
                                </h3>

                                {/* Bank Name */}
                                {driverBankInfo.bank_name && (
                                    <div>
                                        <p className="text-xs text-blue-600 mb-1">Banco</p>
                                        <p className="font-medium text-blue-900">{driverBankInfo.bank_name}</p>
                                    </div>
                                )}

                                {/* Holder Name */}
                                {driverBankInfo.bank_holder_name && (
                                    <div>
                                        <p className="text-xs text-blue-600 mb-1">Beneficiario</p>
                                        <p className="font-medium text-blue-900">{driverBankInfo.bank_holder_name}</p>
                                    </div>
                                )}

                                {/* CLABE */}
                                {driverBankInfo.bank_clabe && (
                                    <div>
                                        <p className="text-xs text-blue-600 mb-1">CLABE</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-blue-900 text-lg tracking-wider">
                                                {formatClabe(driverBankInfo.bank_clabe)}
                                            </p>
                                            <button
                                                onClick={() => handleCopy(driverBankInfo.bank_clabe!, 'CLABE')}
                                                className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 transition-colors"
                                            >
                                                {copied === 'CLABE' ? (
                                                    <Check className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-blue-600" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Card Number */}
                                {driverBankInfo.bank_card_number && (
                                    <div>
                                        <p className="text-xs text-blue-600 mb-1">Número de Tarjeta</p>
                                        <div className="flex items-center gap-2">
                                            <p className="font-mono text-blue-900 text-lg tracking-wider">
                                                {formatCardNumber(driverBankInfo.bank_card_number)}
                                            </p>
                                            <button
                                                onClick={() => handleCopy(driverBankInfo.bank_card_number!, 'Tarjeta')}
                                                className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 transition-colors"
                                            >
                                                {copied === 'Tarjeta' ? (
                                                    <Check className="h-4 w-4 text-green-600" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-blue-600" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-blue-100 rounded-lg p-3">
                                    <p className="text-sm text-blue-800">
                                        💡 Envía la transferencia ahora y el mandadito confirmará cuando la reciba.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Cash Instructions */}
                        {selectedMethod === 'cash' && (
                            <div className="bg-green-50 rounded-xl p-4">
                                <p className="text-sm text-green-800">
                                    💵 Ten listo el monto exacto para pagar al mandadito cuando llegue con tu pedido.
                                </p>
                            </div>
                        )}

                        {/* Confirm Button */}
                        <Button
                            onClick={onClose}
                            disabled={!selectedMethod}
                            className="w-full h-14 text-lg bg-orange-500 hover:bg-orange-600"
                        >
                            Entendido
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
