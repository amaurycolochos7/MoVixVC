"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, CheckCircle, Receipt, ArrowRight, Calculator } from "lucide-react";

interface PaymentSummaryModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    data: {
        serviceFee: number;
        shoppingCost: number;
        total: number;
    };
}

export function PaymentSummaryModal({
    open,
    onClose,
    onConfirm,
    data,
}: PaymentSummaryModalProps) {
    const [amountTendered, setAmountTendered] = useState<string>("");
    const [change, setChange] = useState<number>(0);

    // Calculate change whenever amount tendered updates
    useEffect(() => {
        const tendered = parseFloat(amountTendered) || 0;
        const changeDue = tendered - data.total;
        setChange(changeDue > 0 ? changeDue : 0);
    }, [amountTendered, data.total]);

    const isValidPayment = (parseFloat(amountTendered) || 0) >= data.total;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-md bg-white border-gray-200">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
                        <Receipt className="h-6 w-6 text-green-600" />
                    </div>
                    <DialogTitle className="text-center text-xl">Resumen de Cobro</DialogTitle>
                    <DialogDescription className="text-center text-gray-600">
                        Confirma el pago recibido del cliente antes de finalizar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Summary Card */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Costo del Servicio (Envío)</span>
                            <span className="font-medium text-gray-900">${data.serviceFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Costo de Compras</span>
                            <span className="font-medium text-gray-900">${data.shoppingCost.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-gray-200 my-2" />
                        <div className="flex justify-between items-end">
                            <span className="font-bold text-gray-900">Total a Cobrar</span>
                            <span className="font-extrabold text-2xl text-green-600">${data.total.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Calculator Section */}
                    <div className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="tendered" className="text-gray-700 font-medium flex items-center gap-2">
                                <Calculator className="w-4 h-4" />
                                ¿Con cuánto paga el cliente?
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                                <Input
                                    id="tendered"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.50"
                                    placeholder="0.00"
                                    value={amountTendered}
                                    onChange={(e) => setAmountTendered(e.target.value)}
                                    className="pl-10 h-12 text-lg font-semibold bg-white border-gray-300 focus:border-green-500 focus:ring-green-500"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Change Display */}
                        <div className={`p-4 rounded-xl border transition-colors duration-200 ${isValidPayment
                                ? "bg-green-50 border-green-200"
                                : "bg-red-50 border-red-200"
                            }`}>
                            <div className="flex justify-between items-center">
                                <span className={`font-medium ${isValidPayment ? "text-green-700" : "text-red-700"}`}>
                                    {isValidPayment ? "Cambio a devolver:" : "Falta por pagar:"}
                                </span>
                                <span className={`text-2xl font-bold ${isValidPayment ? "text-green-700" : "text-red-700"}`}>
                                    ${Math.abs(change).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 shadow-lg font-bold"
                        onClick={onConfirm}
                        disabled={!isValidPayment && amountTendered !== ""} // Disable if partial payment (unless empty, but empty is invalid logicwise, let's allow "skip" if needed? No, strict.)
                    // Actually, user might want to calculate even if not exact. But "Accept" should imply "Done".
                    // Let's enable button but maybe show warning? Stick to strict for now to prevent mistakes.
                    >
                        <CheckCircle className="mr-2 h-5 w-5" />
                        Finalizar Servicio
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
