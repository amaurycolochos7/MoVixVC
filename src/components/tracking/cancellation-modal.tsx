"use client";
// forcing rebuild

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Clock, MapPin } from "lucide-react";

interface CancellationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    canCancel: boolean;
    restrictionReason?: "time" | "distance" | null;
    restrictionMessage?: string;
}

const CANCELLATION_REASONS = [
    "Demora mucho tiempo",
    "El conductor no se mueve",
    "Encontré otro transporte",
    "Pedí por error",
    "Otro motivo"
];

export function CancellationModal({
    open,
    onClose,
    onConfirm,
    canCancel,
    restrictionReason,
    restrictionMessage
}: CancellationModalProps) {
    const [reason, setReason] = useState<string>(CANCELLATION_REASONS[0]);
    const [otherReason, setOtherReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = () => {
        setIsSubmitting(true);
        const finalReason = reason === "Otro motivo" ? otherReason : reason;
        onConfirm(finalReason || "No especificado");
        setIsSubmitting(false); // actually mostly likely unmounts
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Cancelar Viaje
                    </DialogTitle>
                    <DialogDescription>
                        Esta acción no se puede deshacer.
                    </DialogDescription>
                </DialogHeader>

                {!canCancel ? (
                    <div className="py-4 space-y-4">
                        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
                            {restrictionReason === 'time' ? (
                                <Clock className="h-5 w-5 text-red-600 mt-0.5" />
                            ) : (
                                <MapPin className="h-5 w-5 text-red-600 mt-0.5" />
                            )}
                            <div>
                                <h4 className="font-semibold text-red-700 text-sm">No es posible cancelar ahora</h4>
                                <p className="text-red-600 text-sm mt-1 leading-normal">
                                    {restrictionMessage || "El viaje ya no puede ser cancelado en este estado."}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                            Si tienes un problema urgente, por favor contacta a soporte o llama al conductor.
                        </p>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        <Label className="text-base font-semibold">¿Por qué quieres cancelar?</Label>
                        <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                            {CANCELLATION_REASONS.map((r) => (
                                <div key={r} className="flex items-center space-x-2">
                                    <RadioGroupItem value={r} id={r} />
                                    <Label htmlFor={r} className="font-normal cursor-pointer">{r}</Label>
                                </div>
                            ))}
                        </RadioGroup>

                        {reason === "Otro motivo" && (
                            <Textarea
                                placeholder="Cuéntanos más..."
                                value={otherReason}
                                onChange={(e) => setOtherReason(e.target.value)}
                                className="mt-2"
                            />
                        )}
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {!canCancel ? (
                        <Button variant="outline" onClick={onClose} className="w-full">
                            Entendido, continuar viaje
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                                Volver
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleConfirm}
                                disabled={isSubmitting || (reason === "Otro motivo" && !otherReason.trim())}
                            >
                                {isSubmitting ? "Cancelando..." : "Confirmar Cancelación"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
