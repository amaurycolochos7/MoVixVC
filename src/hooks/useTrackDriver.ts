"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface DriverPosition {
    lat: number;
    lng: number;
    updatedAt: string;
}

/**
 * Hook for clients to track a driver's position in real-time
 * Subscribes to Supabase Realtime for instant updates
 */
export function useTrackDriver(driverId: string | null) {
    const supabase = createClient();
    const [position, setPosition] = useState<DriverPosition | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch initial position
    const fetchPosition = useCallback(async () => {
        if (!driverId) {
            setPosition(null);
            setLoading(false);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from("users")
                .select("current_lat, current_lng, location_updated_at")
                .eq("id", driverId)
                .single();

            if (fetchError) throw fetchError;

            if (data && data.current_lat && data.current_lng) {
                setPosition({
                    lat: parseFloat(data.current_lat),
                    lng: parseFloat(data.current_lng),
                    updatedAt: data.location_updated_at || new Date().toISOString(),
                });
            }
        } catch (err: any) {
            console.error("Error fetching driver position:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [driverId, supabase]);

    useEffect(() => {
        if (!driverId) {
            setPosition(null);
            setLoading(false);
            return;
        }

        fetchPosition();

        // Subscribe to realtime updates
        const channel = supabase
            .channel(`driver-location-${driverId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "users",
                    filter: `id=eq.${driverId}`,
                },
                (payload) => {
                    const newData = payload.new as any;
                    if (newData.current_lat && newData.current_lng) {
                        setPosition({
                            lat: parseFloat(newData.current_lat),
                            lng: parseFloat(newData.current_lng),
                            updatedAt: newData.location_updated_at || new Date().toISOString(),
                        });
                    }
                }
            )
            .subscribe();

        // Also poll every 5 seconds as backup (in case realtime misses something)
        const pollInterval = setInterval(fetchPosition, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollInterval);
        };
    }, [driverId, fetchPosition, supabase]);

    return {
        position,
        loading,
        error,
        refetch: fetchPosition,
    };
}
