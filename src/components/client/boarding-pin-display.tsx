"use client";

import { Shield } from "lucide-react";

interface BoardingPinDisplayProps {
    pin: string;
    driverName?: string;
}

export function BoardingPinDisplay({ pin, driverName }: BoardingPinDisplayProps) {
    if (!pin) return null;

    // Split PIN into individual digits for better visual display
    const digits = pin.split("");

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-white" />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                        Código de Confirmación
                    </h3>
                </div>
            </div>

            {/* PIN Display */}
            <div className="px-4 py-6">
                <div className="flex justify-center gap-3 mb-4">
                    {digits.map((digit, index) => (
                        <div
                            key={index}
                            className="w-14 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-300 flex items-center justify-center shadow-sm"
                        >
                            <span className="text-4xl font-bold text-blue-600 tabular-nums">
                                {digit}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Instructions */}
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-gray-800">
                        Muestra este código a Jorge chofer
                    </p>
                    <p className="text-xs text-gray-500">
                        El conductor lo necesita para iniciar el viaje
                    </p>
                </div>

                {/* Security Note */}
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-800 text-center font-medium flex items-center justify-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" />
                        No compartas este código con nadie más
                    </p>
                </div>
            </div>
        </div>
    );
}
