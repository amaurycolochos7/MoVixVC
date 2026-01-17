"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function TaxiServicioPage() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkActiveService = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: activeService } = await supabase
                    .from("service_requests")
                    .select("id")
                    .eq("assigned_driver_id", user.id)
                    .in("status", ["assigned", "in_progress"])
                    .maybeSingle();

                if (activeService) {
                    router.push(`/taxi/servicio/${activeService.id}`);
                }
            } catch (error) {
                console.error("Error checking active service:", error);
            } finally {
                setLoading(false);
            }
        };

        checkActiveService();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4">
            <h1 className="text-xl font-bold">Servicio Actual</h1>
            <div className="p-10 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-slate-600 font-medium">No tienes un servicio activo.</p>
                <p className="text-xs text-slate-400 mt-2">Ve a la pestaña Disponibles o Solicitudes para tomar uno.</p>
            </div>
        </div>
    );
}
