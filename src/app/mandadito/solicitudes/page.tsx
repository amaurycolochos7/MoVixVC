"use client";

import { Radar } from "@/components/radar/radar";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MandaditoSolicitudesPage() {
    const [isAvailable, setIsAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    // Check driver availability on load
    useEffect(() => {
        const checkStatus = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("users")
                    .select("is_available")
                    .eq("id", user.id)
                    .single();

                setIsAvailable(data?.is_available || false);
            }
            setLoading(false);
        };

        checkStatus();
    }, [supabase]);

    if (loading) {
        return (
            <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-100 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-white px-5 py-4 border-b border-gray-200">
                <h1 className="text-xl font-bold text-gray-900">Mandaditos Disponibles</h1>
                <p className="text-sm text-gray-500">
                    {isAvailable ? "Las solicitudes aparecen automáticamente" : "Activa tu disponibilidad para ver solicitudes"}
                </p>
            </div>

            {/* Radar List - Auto-updates */}
            <div className="flex-1 overflow-y-auto pb-20 min-h-0">
                <Radar serviceType="mandadito" isAvailable={isAvailable} />
            </div>
        </div>
    );
}
