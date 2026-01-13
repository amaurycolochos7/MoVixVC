"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Wallet, CheckCircle } from "lucide-react";

interface PaymentModalProps {
    open: boolean;
    totalAmount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export function PaymentModal({ open, totalAmount, onConfirm, onCancel }: PaymentModalProps) {
    const [amountPaid, setAmountPaid] = useState<string>("");
    const change = amountPaid ? Math.max(0, parseFloat(amountPaid) - totalAmount) : 0;
    const isValid = amountPaid && parseFloat(amountPaid) >= totalAmount;

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="bg-white text-slate-900 rounded-2xl max-w-sm w-[90%] p-6 border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-bold mb-4">
                        Registrar Pago
                    </DialogTitle>
                </DialogHeader>

                {/* Price Breakdown for Mandadito */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 mb-4">
                    <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-3 text-center">
                        Resumen del Servicio
                    </p>

                    {/* Base Service */}
                    <div className="flex justify-between items-center mb-2 text-gray-700">
                        <span className="text-sm">Servicio base</span>
                        <span className="text-lg font-bold">$25.00</span>
                    </div>

                    {/* App Commission */}
                    <div className="flex justify-between items-center mb-3 text-gray-600 border-b border-blue-200 pb-3">
                        <span className="text-sm">Comisión app</span>
                        <span className="text-lg font-semibold">$3.00</span>
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-700 uppercase">Total a cobrar</span>
                        <div className="flex items-center gap-1">
                            <DollarSign className="h-6 w-6 text-blue-700" />
                            <span className="text-3xl font-black text-blue-700">
                                {totalAmount.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Amount Paid Input */}
                <div className="mb-4">
                    <label className="text-sm font-bold text-gray-700 mb-2 block flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        ¿Con cuánto paga el cliente?
                    </label>
                    <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            className="text-2xl font-bold pl-12 h-16 text-center bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Change Display */}
                {amountPaid && (
                    <div className={`rounded-xl p-4 mb-4 border-2 transition-all ${isValid
                        ? "bg-green-50 border-green-300"
                        : "bg-red-50 border-red-300"
                        }`}>
                        <p className="text-xs font-medium uppercase tracking-wide mb-2 text-center text-gray-600">
                            Cambio a entregar
                        </p>
                        <div className="flex items-center justify-center gap-2">
                            <span className={`text-3xl font-black ${isValid ? "text-green-700" : "text-red-600"
                                }`}>
                                ${change.toFixed(2)}
                            </span>
                        </div>
                        {!isValid && (
                            <p className="text-xs text-red-600 text-center mt-2">
                                ⚠️ El monto pagado es menor al total
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
                    <Button
                        onClick={onConfirm}
                        disabled={!isValid}
                        className="w-full bg-green-600 hover:bg-green-700 h-14 text-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Confirmar y Finalizar
                    </Button>
                    <Button
                        onClick={onCancel}
                        variant="ghost"
                        className="w-full h-12 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    >
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
