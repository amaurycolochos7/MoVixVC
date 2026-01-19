"use client";

import { Package } from "lucide-react";

export default function MandaditoServicioPage() {
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white px-5 py-4 border-b border-gray-100">
                <h1 className="text-lg font-bold text-gray-900">Servicio Actual</h1>
            </div>

            {/* Empty State */}
            <div className="px-4 py-8">
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="h-8 w-8 text-orange-400" />
                    </div>
                    <h2 className="text-gray-900 font-semibold text-lg mb-2">
                        Sin servicio activo
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Cuando aceptes un mandadito, aparecerá aquí
                    </p>
                </div>
            </div>
        </div>
    );
}
