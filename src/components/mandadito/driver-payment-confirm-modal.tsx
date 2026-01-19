"use client";

import { useState } from "react";
import { X, Banknote, CreditCard, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface DriverPaymentConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: string;
    expectedAmount: number;
    onConfirmed: () => void;
}

export function DriverPaymentConfirmModal({
    isOpen,
    onClose,
    requestId,
    expectedAmount,
    onConfirmed
}: DriverPaymentConfirmModalProps) {
    const supabase = createClient();
    const [selectedMethod, setSelectedMethod] = useState<'cash' | 'transfer' | null>(null);
    const [amount, setAmount] = useState(expectedAmount.toString());
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        if (!selectedMethod) {
            toast.error("Selecciona el método de pago");
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Ingresa un monto válido");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from("service_requests")
                .update({
                    payment_method: selectedMethod,
                    payment_amount: numAmount,
                    payment_confirmed_at: new Date().toISOString()
                })
                .eq("id", requestId);

            if (error) throw error;

            toast.success("Pago registrado correctamente");
            onConfirmed();
            onClose();
        } catch (err) {
            console.error("Error confirming payment:", err);
            toast.error("Error al registrar el pago");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-x-0 bottom-0 z-50">
                <div className="bg-white rounded-t-3xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900">Confirmar Cobro</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Amount Input */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Monto cobrado
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">$</span>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="pl-10 h-14 text-2xl font-bold text-center"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">
                                ¿Cómo te pagaron?
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Cash */}
                                <button
                                    onClick={() => setSelectedMethod('cash')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedMethod === 'cash'
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedMethod === 'cash' ? 'bg-green-500' : 'bg-gray-100'
                                        }`}>
                                        <Banknote className={`h-6 w-6 ${selectedMethod === 'cash' ? 'text-white' : 'text-gray-500'
                                            }`} />
                                    </div>
                                    <span className={`font-medium ${selectedMethod === 'cash' ? 'text-green-700' : 'text-gray-700'
                                        }`}>Efectivo</span>
                                    {selectedMethod === 'cash' && (
                                        <Check className="h-5 w-5 text-green-500" />
                                    )}
                                </button>

                                {/* Transfer */}
                                <button
                                    onClick={() => setSelectedMethod('transfer')}
                                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedMethod === 'transfer'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedMethod === 'transfer' ? 'bg-blue-500' : 'bg-gray-100'
                                        }`}>
                                        <CreditCard className={`h-6 w-6 ${selectedMethod === 'transfer' ? 'text-white' : 'text-gray-500'
                                            }`} />
                                    </div>
                                    <span className={`font-medium ${selectedMethod === 'transfer' ? 'text-blue-700' : 'text-gray-700'
                                        }`}>Transferencia</span>
                                    {selectedMethod === 'transfer' && (
                                        <Check className="h-5 w-5 text-blue-500" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedMethod || loading}
                            className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            ) : (
                                <Check className="h-5 w-5 mr-2" />
                            )}
                            Confirmar Cobro
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
