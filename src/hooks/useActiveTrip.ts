import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useActiveTrip(userRole: "client" | "driver") {
    const [activeTrip, setActiveTrip] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const checkActiveTrip = async () => {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) {
                setLoading(false);
                return;
            }

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

            if (data) setActiveTrip(data);
            setLoading(false);
        };

        checkActiveTrip();
    }, [userRole, supabase]);

    return { activeTrip, loading };
}
