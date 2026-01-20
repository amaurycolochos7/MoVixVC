import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useActiveTrip(userRole: "client" | "driver") {
    const [activeTrip, setActiveTrip] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        let pollInterval: NodeJS.Timeout | null = null;
        let userId: string | null = null;

        const checkActiveTrip = async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) {
                setLoading(false);
                return null;
            }

            userId = user.id; // Cache for realtime

            let query = supabase.from("service_requests").select("*");

            // Filter by role
            if (userRole === "client") {
                query = query.eq("client_id", user.id);
            } else {
                query = query.eq("assigned_driver_id", user.id);
            }

            // Filter by active status
            query = query.in("status", ["assigned", "in_progress"]);

            const { data } = await query.maybeSingle();

            if (data) {
                setActiveTrip(data);
            } else {
                setActiveTrip(null);
            }
            setLoading(false);
            return data;
        };

        // Initial check
        checkActiveTrip();

        // Fast polling every 1 second to catch new assignments quickly
        pollInterval = setInterval(() => {
            checkActiveTrip();
        }, 1000);

        // Realtime subscription as backup
        const channel = supabase
            .channel('active-trip-updates')
            .on('postgres_changes', {
                event: '*', // Listen to ALL events
                schema: 'public',
                table: 'service_requests',
            }, async (payload) => {
                console.log('🔔 Service update:', payload.eventType, payload);

                const newData = payload.new as any;
                const oldData = payload.old as any;

                // Check if this update is relevant to current user
                const isRelevant = userRole === "client"
                    ? (newData?.client_id === userId || oldData?.client_id === userId)
                    : (newData?.assigned_driver_id === userId || oldData?.assigned_driver_id === userId);

                if (!isRelevant) return;

                // If service is active
                if (newData && ["assigned", "in_progress"].includes(newData.status)) {
                    console.log('✅ Active service:', newData.id, newData.status);
                    setActiveTrip(newData);
                }
                // If service was cancelled, completed, or deleted
                else if (payload.eventType === 'DELETE' ||
                    (newData && !["assigned", "in_progress"].includes(newData.status))) {
                    console.log('❌ Service ended:', newData?.id, newData?.status);
                    setActiveTrip(null);
                }
            })
            .subscribe();

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            supabase.removeChannel(channel);
        };
    }, [userRole, supabase]);

    return { activeTrip, loading };
}
