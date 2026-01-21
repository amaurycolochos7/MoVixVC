"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Loader2 } from "lucide-react";

interface BoardingPinModalProps {
    open: boolean;
    onClose: () => void;
    onValidate: (pin: string) => Promise<boolean>;
    pinLength?: number; // 3 for moto_ride, 4 for taxi/others
}

export function BoardingPinModal({ open, onClose, onValidate, pinLength = 4 }: BoardingPinModalProps) {
    const [pin, setPin] = useState("");
    const [isValidating, setIsValidating] = useState(false);
    const [error, setError] = useState("");

    const handlePinChange = (value: string) => {
        // Solo números, máximo según pinLength
        const cleaned = value.replace(/\D/g, "").slice(0, pinLength);
        setPin(cleaned);
        setError("");
    };

    const handleValidate = async () => {
        if (pin.length !== pinLength) {
            setError(`El código debe tener ${pinLength} dígitos`);
            return;
        }

        setIsValidating(true);
        setError("");

        try {
            const isValid = await onValidate(pin);
            if (!isValid) {
                setError("Código incorrecto. Verifica con el cliente.");
                setPin("");
            } else {
                // Modal se cierra automáticamente desde el padre
                setPin("");
            }
        } catch (err) {
            setError("Error al validar. Intenta de nuevo.");
        } finally {
            setIsValidating(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && pin.length === pinLength) {
            handleValidate();
        }
    };

    // Determine if this is moto_ride style (3 digits = orange theme)
    const isMotoRide = pinLength === 3;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className={`flex items-center gap-2 ${isMotoRide ? 'text-orange-600' : 'text-blue-700'}`}>
                        <Shield className="h-5 w-5" />
                        Iniciar Viaje con Cliente
                    </DialogTitle>
                    <DialogDescription>
                        Solicita al cliente su código de {pinLength} dígitos
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* PIN Input */}
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-gray-600 text-center">
                            Pregunta al cliente: <strong>"¿Cuál es tu código?"</strong>
                        </p>

                        <div className="flex gap-2 justify-center">
                            <Input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={pinLength}
                                value={pin}
                                onChange={(e) => handlePinChange(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={pinLength === 3 ? "000" : "0000"}
                                className={`text-center text-2xl font-bold tracking-widest ${pinLength === 3 ? 'w-28' : 'w-32'} h-14 ${isMotoRide ? 'focus:ring-orange-500 focus:border-orange-500' : ''}`}
                                autoFocus
                                disabled={isValidating}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 w-full">
                                <p className="text-red-700 text-sm text-center font-medium">
                                    {error}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Info adicional */}
                    <div className={`${isMotoRide ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'} border rounded-lg p-3`}>
                        <p className={`text-xs ${isMotoRide ? 'text-orange-700' : 'text-blue-700'} text-center`}>
                            El cliente puede ver su código en la pantalla de seguimiento
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isValidating}
                        className="flex-1"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleValidate}
                        disabled={pin.length !== pinLength || isValidating}
                        className={`flex-1 ${isMotoRide ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isValidating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Validando...
                            </>
                        ) : (
                            "Confirmar"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
