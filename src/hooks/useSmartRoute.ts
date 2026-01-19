"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Coordinates, calculateDistance, TRACKING_CONFIG } from "./useAnimatedMarker";
import { getRoute, RouteResult } from "@/lib/mapbox";

interface UseSmartRouteOptions {
    /** Current position of the driver */
    driverPosition: Coordinates | null;
    /** Origin point (pickup location for "going to pickup" phase) */
    origin: Coordinates;
    /** Destination point (dropoff location for "in trip" phase) */
    destination?: Coordinates;
    /** Current phase: "pickup" = driving to client, "trip" = taking client to destination */
    phase: "pickup" | "trip";
    /** Interval for time-based recalculation (seconds) */
    rerouteIntervalS?: number;
    /** Distance from route to trigger recalculation (meters) */
    offRouteMeters?: number;
}

interface SmartRouteState {
    route: RouteResult | null;
    isLoading: boolean;
    lastCalculated: number;
    isOffRoute: boolean;
    eta: number; // minutes
    distance: number; // kilometers
}

/**
 * Calculate minimum distance from a point to a polyline
 */
function distanceToPolyline(point: Coordinates, polyline: number[][]): number {
    let minDist = Infinity;

    for (let i = 0; i < polyline.length - 1; i++) {
        const [lng1, lat1] = polyline[i];
        const [lng2, lat2] = polyline[i + 1];

        // Calculate distance to line segment
        const dist = distanceToSegment(point, { lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
        minDist = Math.min(minDist, dist);
    }

    return minDist;
}

/**
 * Calculate distance from point to line segment
 */
function distanceToSegment(point: Coordinates, segStart: Coordinates, segEnd: Coordinates): number {
    const dx = segEnd.lng - segStart.lng;
    const dy = segEnd.lat - segStart.lat;

    if (dx === 0 && dy === 0) {
        return calculateDistance(point, segStart);
    }

    let t = ((point.lng - segStart.lng) * dx + (point.lat - segStart.lat) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));

    const closest: Coordinates = {
        lng: segStart.lng + t * dx,
        lat: segStart.lat + t * dy,
    };

    return calculateDistance(point, closest);
}

/**
 * Hook for smart route calculation with intelligent recalculation
 * Only recalculates when:
 * - Time threshold exceeded (30s)
 * - Driver is off-route (>70m from polyline)
 * - Phase changes
 */
export function useSmartRoute(options: UseSmartRouteOptions) {
    const {
        driverPosition,
        origin,
        destination,
        phase,
        rerouteIntervalS = TRACKING_CONFIG.REROUTE_INTERVAL_S,
        offRouteMeters = TRACKING_CONFIG.OFF_ROUTE_METERS,
    } = options;

    const [state, setState] = useState<SmartRouteState>({
        route: null,
        isLoading: false,
        lastCalculated: 0,
        isOffRoute: false,
        eta: 0,
        distance: 0,
    });

    const polylineRef = useRef<number[][] | null>(null);
    const phaseRef = useRef<string>(phase);

    // Haversine distance helper
    const calculateHaversineDistance = (p1: Coordinates, p2: Coordinates) => {
        const R = 6371e3; // metres
        const φ1 = p1.lat * Math.PI / 180;
        const φ2 = p2.lat * Math.PI / 180;
        const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
        const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    /**
     * Fetch new route from Mapbox Directions API
     */
    const fetchRoute = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true }));

        // Validation: Driver Position
        if (!driverPosition || driverPosition.lat === 0 || driverPosition.lng === 0) {
            if (process.env.NODE_ENV === "development") {
                console.warn("⚠️ [useSmartRoute] Skipping route: Invalid driver position", driverPosition);
            }
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        // Phase Strategy: Define origin/destination based on phase
        let start: Coordinates = driverPosition;
        let end: Coordinates = origin; // Default target is origin (pickup location)

        if (phase === "trip") {
            // In trip phase, we go from Driver (who is at pickup/en route) -> Dropoff
            if (!destination) {
                console.warn("⚠️ [useSmartRoute] Trip phase but no destination provided");
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }
            end = destination;
        }

        // Validation: Target
        if (!end || end.lat === 0 || end.lng === 0) {
            console.warn("⚠️ [useSmartRoute] Skipping route: Invalid target", end);
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        // Validation: Distance Sanity Check
        const dist = calculateHaversineDistance(start, end);

        // Debug Logging (Dev Only)
        if (process.env.NODE_ENV === "development") {
            console.groupCollapsed(`🛣️ [useSmartRoute] Calculation - Phase: ${phase}`);
            console.table({
                driver: { lat: start.lat.toFixed(5), lng: start.lng.toFixed(5) },
                target: { lat: end.lat.toFixed(5), lng: end.lng.toFixed(5) },
                phase: phase,
                linearDistance: `${(dist / 1000).toFixed(2)} km`
            });
            console.groupEnd();
        }

        if (dist > 300000) { // 300km sanity limit
            console.error(`🚨 [useSmartRoute] EXTREME DISTANCE DETECTED: ${(dist / 1000).toFixed(1)}km. Check coordinates!`);
        }

        try {
            const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
            if (!MAPBOX_TOKEN) {
                console.warn("Mapbox token missing");
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            const query = `${start.lng},${start.lat};${end.lng},${end.lat}`;
            // Use driving-traffic for better accuracy and real-world conditions
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${query}?alternatives=false&geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;

            const res = await fetch(url);
            const data = await res.json();

            if (!data.routes || data.routes.length === 0) {
                console.warn("No route found");
                setState(prev => ({ ...prev, isLoading: false }));
                return;
            }

            const routeData = data.routes[0];
            const coords = routeData.geometry.coordinates as number[][];
            polylineRef.current = coords;

            setState({
                route: routeData,
                isLoading: false,
                lastCalculated: Date.now(),
                isOffRoute: false,
                eta: Math.round(routeData.duration / 60),
                distance: Number((routeData.distance / 1000).toFixed(1)),
            });

        } catch (err) {
            console.error("Error fetching route:", err);
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [driverPosition, origin, destination, phase]);

    /**
     * Check if driver is off-route
     */
    const checkOffRoute = useCallback(() => {
        if (!driverPosition || !polylineRef.current || polylineRef.current.length < 2) {
            return false;
        }

        const distanceToRoute = distanceToPolyline(driverPosition, polylineRef.current);
        const isOff = distanceToRoute > offRouteMeters;

        if (isOff && !state.isOffRoute) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`⚠️ Off route! Distance: ${distanceToRoute.toFixed(0)}m`);
            }
        }

        return isOff;
    }, [driverPosition, offRouteMeters, state.isOffRoute]);

    /**
     * Determine if recalculation is needed
     */
    const shouldRecalculate = useCallback(() => {
        // Phase changed
        if (phaseRef.current !== phase) {
            if (process.env.NODE_ENV === "development") {
                console.log(`🔄 [useSmartRoute] PHASE CHANGED: ${phaseRef.current} → ${phase}`);
            }
            phaseRef.current = phase;
            return true;
        }

        // No route yet
        if (!state.route) return true;

        // Time threshold exceeded
        const timeSinceLastCalc = (Date.now() - state.lastCalculated) / 1000;
        if (timeSinceLastCalc > rerouteIntervalS) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`⏱️ Recalc trigger: time (${timeSinceLastCalc.toFixed(0)}s)`);
            }
            return true;
        }

        // Off-route
        if (checkOffRoute()) {
            return true;
        }

        return false;
    }, [phase, state.route, state.lastCalculated, rerouteIntervalS, checkOffRoute]);

    // Check for recalculation on position changes
    useEffect(() => {
        if (!driverPosition) return;

        // Update off-route state
        const isOff = checkOffRoute();
        if (isOff !== state.isOffRoute) {
            setState(prev => ({ ...prev, isOffRoute: isOff }));
        }

        if (shouldRecalculate()) {
            fetchRoute();
        }
    }, [driverPosition, shouldRecalculate, fetchRoute, checkOffRoute, state.isOffRoute]);

    // Initial route calculation
    useEffect(() => {
        if (driverPosition && !state.route && !state.isLoading) {
            fetchRoute();
        }
    }, [driverPosition, state.route, state.isLoading, fetchRoute]);

    /**
     * Force recalculation
     */
    const forceRecalculate = useCallback(() => {
        fetchRoute();
    }, [fetchRoute]);

    return {
        route: state.route,
        isLoading: state.isLoading,
        isOffRoute: state.isOffRoute,
        eta: state.eta,
        distance: state.distance,
        forceRecalculate,
        polyline: polylineRef.current,
    };
}
