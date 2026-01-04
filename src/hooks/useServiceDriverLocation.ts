"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GPSPoint } from "./useAnimatedMarker";
import { RealtimeChannel } from "@supabase/supabase-js";

interface ServiceLocation {
    id: string;
    service_id: string;
    driver_id: string;
    lat: number;
    lng: number;
    accuracy?: number;
    bearing?: number;
    speed?: number;
    created_at: string;
}

interface UseServiceDriverLocationOptions {
    serviceId: string;
    onLocationUpdate?: (point: GPSPoint) => void;
    enabled?: boolean;
}

interface ServiceDriverLocationState {
    lastLocation: GPSPoint | null;
    isConnected: boolean;
    lastUpdateTime: number;
    error: string | null;
    pointsReceived: number;
}

/**
 * Hook to subscribe to driver's real-time location for a specific service
 * Fetches initial position and then subscribes to Realtime updates
 * Filters out-of-order points and provides connection status
 */
export function useServiceDriverLocation(options: UseServiceDriverLocationOptions) {
    const { serviceId, onLocationUpdate, enabled = true } = options;

    const supabase = createClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const lastTimestampRef = useRef<number>(0);

    const [state, setState] = useState<ServiceDriverLocationState>({
        lastLocation: null,
        isConnected: false,
        lastUpdateTime: 0,
        error: null,
        pointsReceived: 0,
    });

    /**
     * Convert ServiceLocation to GPSPoint
     */
    const toGPSPoint = (location: ServiceLocation): GPSPoint => {
        const timestamp = new Date(location.created_at).getTime();
        return {
            lat: location.lat,
            lng: location.lng,
            accuracy: location.accuracy,
            timestamp,
        };
    };

    /**
     * Process incoming location point
     * Filters out-of-order points by timestamp
     */
    const processLocation = (location: ServiceLocation) => {
        const point = toGPSPoint(location);

        // Filter out-of-order points (timestamp must be newer than last)
        if (point.timestamp <= lastTimestampRef.current) {
            console.log(`🚫 Out-of-order point rejected: ${new Date(point.timestamp).toISOString()}`);
            return;
        }

        lastTimestampRef.current = point.timestamp;

        setState(prev => ({
            ...prev,
            lastLocation: point,
            lastUpdateTime: Date.now(),
            pointsReceived: prev.pointsReceived + 1,
        }));

        // Notify callback
        if (onLocationUpdate) {
            onLocationUpdate(point);
        }

        console.log(`📍 Location update: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`);
    };

    /**
     * Fetch the most recent location for this service
     */
    const fetchInitialLocation = async () => {
        try {
            const { data, error } = await supabase
                .from("service_locations")
                .select("*")
                .eq("service_id", serviceId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (error) {
                // No locations yet is not an error
                if (error.code === "PGRST116") {
                    console.log("No initial location yet");
                    return;
                }
                throw error;
            }

            if (data) {
                processLocation(data as ServiceLocation);
                console.log("✅ Initial location loaded");
            }
        } catch (err: any) {
            console.error("Error fetching initial location:", err);
            setState(prev => ({
                ...prev,
                error: err.message,
            }));
        }
    };

    /**
     * Subscribe to Realtime updates
     */
    const subscribeToUpdates = () => {
        // Clean up existing subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        console.log(`🔌 Subscribing to service ${serviceId} locations...`);

        const channel = supabase
            .channel(`service-locations-${serviceId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "service_locations",
                    filter: `service_id=eq.${serviceId}`,
                },
                (payload) => {
                    console.log("📡 Realtime location received");
                    processLocation(payload.new as ServiceLocation);
                }
            )
            .subscribe((status) => {
                console.log(`Realtime status: ${status}`);
                setState(prev => ({
                    ...prev,
                    isConnected: status === "SUBSCRIBED",
                    error: status === "CHANNEL_ERROR" ? "Connection error" : null,
                }));
            });

        channelRef.current = channel;
    };

    /**
     * Initialize: fetch initial + subscribe
     */
    useEffect(() => {
        if (!enabled || !serviceId) return;

        fetchInitialLocation();
        subscribeToUpdates();

        // Cleanup
        return () => {
            if (channelRef.current) {
                console.log("🔌 Unsubscribing from service locations");
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [serviceId, enabled]);

    /**
     * Reconnect logic: retry if disconnected
     */
    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            // If not connected and no recent error, try to reconnect
            if (!state.isConnected && !state.error) {
                console.log("🔄 Attempting reconnect...");
                subscribeToUpdates();
            }
        }, 5000); // Retry every 5s

        return () => clearInterval(interval);
    }, [state.isConnected, state.error, enabled]);

    /**
     * Manual refresh
     */
    const refresh = async () => {
        await fetchInitialLocation();
    };

    /**
     * Calculate staleness (seconds since last update)
     */
    const getStaleness = (): number => {
        if (!state.lastUpdateTime) return Infinity;
        return Math.floor((Date.now() - state.lastUpdateTime) / 1000);
    };

    return {
        lastLocation: state.lastLocation,
        isConnected: state.isConnected,
        error: state.error,
        pointsReceived: state.pointsReceived,
        staleness: getStaleness(),
        isStale: getStaleness() > 10, // > 10s is stale
        refresh,
    };
}
