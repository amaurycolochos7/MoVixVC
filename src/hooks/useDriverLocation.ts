"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseDriverLocationOptions {
    enabled?: boolean;
    intervalMs?: number;
    serviceId?: string; // Service to broadcast location to
}

interface DriverPosition {
    lat: number;
    lng: number;
}

/**
 * Hook for drivers to continuously broadcast their GPS location
 * - Updates users table with current_lat/lng (for radar/legacy)
 * - Inserts into service_locations if serviceId provided (for active service tracking)
 * Returns the current position for local use (e.g. maps)
 */
export function useDriverLocation(options: UseDriverLocationOptions = {}) {
    const { enabled = true, intervalMs = 3000, serviceId } = options;
    const supabase = createClient();
    const watchIdRef = useRef<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastPositionRef = useRef<DriverPosition | null>(null);
    const lastBearingRef = useRef<number>(0);

    // Live position state for UI consumption
    const [currentPosition, setCurrentPosition] = useState<DriverPosition | null>(null);
    const [gpsError, setGpsError] = useState<string | null>(null);

    /**
     * Calculate bearing between two points
     */
    const calculateBearing = useCallback((from: DriverPosition, to: DriverPosition): number => {
        const dLng = (to.lng - from.lng) * Math.PI / 180;
        const lat1 = from.lat * Math.PI / 180;
        const lat2 = to.lat * Math.PI / 180;

        const x = Math.sin(dLng) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

        let bearing = Math.atan2(x, y) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }, []);

    /**
     * Broadcast location to service_locations table (for active service)
     */
    const broadcastToService = useCallback(async (
        lat: number,
        lng: number,
        accuracy?: number,
        bearing?: number,
        speed?: number
    ) => {
        if (!serviceId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from("service_locations")
                .insert({
                    service_id: serviceId,
                    driver_id: user.id,
                    lat,
                    lng,
                    accuracy,
                    bearing,
                    speed,
                });

            if (error) {
                console.warn("Error broadcasting to service_locations:", error);
            } else {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`📡 Location broadcast to service ${serviceId}`);
                }
            }
        } catch (err) {
            console.warn("Failed to broadcast location:", err);
        }
    }, [serviceId, supabase]);

    const updateLocation = useCallback(async (
        lat: number,
        lng: number,
        accuracy?: number,
        speed?: number
    ) => {
        // Always update current position state for UI
        setCurrentPosition({ lat, lng });
        setGpsError(null); // Clear any previous error

        // Calculate bearing if we have a previous position
        let bearing = lastBearingRef.current;
        if (lastPositionRef.current) {
            const distance = Math.sqrt(
                Math.pow(lat - lastPositionRef.current.lat, 2) +
                Math.pow(lng - lastPositionRef.current.lng, 2)
            );
            // Only update bearing if moved >5m
            if (distance > 0.00005) {
                bearing = calculateBearing(lastPositionRef.current, { lat, lng });
                lastBearingRef.current = bearing;
            }
        }

        // Only update DB if position changed significantly (>5 meters)
        if (lastPositionRef.current) {
            const dLat = Math.abs(lat - lastPositionRef.current.lat);
            const dLng = Math.abs(lng - lastPositionRef.current.lng);
            // ~5 meters threshold
            if (dLat < 0.00005 && dLng < 0.00005) {
                return; // Position hasn't changed enough for DB update
            }
        }

        lastPositionRef.current = { lat, lng };

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Update users table (for radar/legacy)
            const { error: userError } = await supabase
                .from("users")
                .update({
                    current_lat: lat,
                    current_lng: lng,
                    location_updated_at: new Date().toISOString(),
                })
                .eq("id", user.id);

            if (userError) {
                console.warn("Error updating driver location:", userError);
            }

            // Broadcast to service if active
            if (serviceId) {
                await broadcastToService(lat, lng, accuracy, bearing, speed);
            }
        } catch (err) {
            console.warn("Failed to update location:", err);
        }
    }, [supabase, serviceId, broadcastToService, calculateBearing]);

    const startTracking = useCallback(() => {
        if (!("geolocation" in navigator)) {
            console.warn("Geolocation not supported");
            setGpsError("Geolocalización no soportada");
            return;
        }

        // Use watchPosition for continuous tracking
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, speed } = position.coords;
                updateLocation(latitude, longitude, accuracy, speed || undefined);
            },
            (error) => {
                console.warn("Geolocation warn:", error.message);
                // Only set error if we don't have a position yet
                if (!lastPositionRef.current) {
                    setGpsError(error.message);
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 10000,
            }
        );

        // Also poll at interval as backup
        intervalRef.current = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    updateLocation(
                        position.coords.latitude,
                        position.coords.longitude,
                        position.coords.accuracy,
                        position.coords.speed || undefined
                    );
                },
                () => { }, // Ignore errors on interval
                { enableHighAccuracy: true, maximumAge: 1000 }
            );
        }, intervalMs);
    }, [updateLocation, intervalMs]);

    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (enabled) {
            startTracking();
        } else {
            stopTracking();
        }

        return () => {
            stopTracking();
        };
    }, [enabled, startTracking, stopTracking]);

    return {
        startTracking,
        stopTracking,
        currentPosition,
        lastPosition: lastPositionRef.current,
        gpsError,
    };
}
