"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============ CONFIGURATION ============
export const TRACKING_CONFIG = {
    // Animation
    ANIM_DURATION_MS: 2800, // Slightly less than GPS interval for smooth transitions
    ANIM_FPS: 60,

    // GPS Filtering
    MAX_ACCURACY_M: 40, // Reject points with accuracy > 40m
    MAX_SPEED_KMH: 140, // Reject impossible speeds (teleporting)
    MIN_MOVEMENT_M: 5, // Minimum movement to update bearing

    // Route recalculation
    REROUTE_INTERVAL_S: 30, // Max seconds between route recalcs
    OFF_ROUTE_METERS: 70, // Recalc if > 70m from route

    // Camera
    DEFAULT_ZOOM: 16,
    CAMERA_TRANSITION_MS: 500,
};

// ============ TYPES ============
export interface Coordinates {
    lat: number;
    lng: number;
}

export interface GPSPoint extends Coordinates {
    timestamp: number;
    accuracy?: number;
}

export interface AnimatedMarkerState {
    position: Coordinates;
    bearing: number;
    isAnimating: boolean;
}

// ============ UTILITY FUNCTIONS ============

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
export function calculateDistance(p1: Coordinates, p2: Coordinates): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate bearing between two points in degrees
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;

    const x = Math.sin(dLng) * Math.cos(lat2);
    const y = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

    let bearing = Math.atan2(x, y) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

/**
 * Easing function for smooth animation (ease-out cubic)
 */
export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Interpolate between two coordinates
 */
export function lerpCoordinates(from: Coordinates, to: Coordinates, t: number): Coordinates {
    const easedT = easeOutCubic(t);
    return {
        lat: lerp(from.lat, to.lat, easedT),
        lng: lerp(from.lng, to.lng, easedT),
    };
}

/**
 * Smooth bearing transition (handles 0/360 wraparound)
 */
export function lerpBearing(from: number, to: number, t: number): number {
    let diff = to - from;
    // Handle wraparound
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    let result = from + diff * easeOutCubic(t);
    return (result + 360) % 360;
}

/**
 * Validate GPS point against noise filters
 */
export function isValidGPSPoint(
    newPoint: GPSPoint,
    lastPoint: GPSPoint | null,
    config = TRACKING_CONFIG
): { valid: boolean; reason?: string } {
    // Check accuracy
    if (newPoint.accuracy && newPoint.accuracy > config.MAX_ACCURACY_M) {
        return { valid: false, reason: `Accuracy too low: ${newPoint.accuracy}m` };
    }

    // Check speed (if we have a previous point)
    if (lastPoint) {
        const distance = calculateDistance(lastPoint, newPoint);
        const timeDiff = (newPoint.timestamp - lastPoint.timestamp) / 1000; // seconds

        if (timeDiff > 0) {
            const speedKmh = (distance / timeDiff) * 3.6; // m/s to km/h
            if (speedKmh > config.MAX_SPEED_KMH) {
                return { valid: false, reason: `Impossible speed: ${speedKmh.toFixed(0)} km/h` };
            }
        }
    }

    return { valid: true };
}

// ============ MAIN HOOK ============

interface UseAnimatedMarkerOptions {
    animDurationMs?: number;
    config?: typeof TRACKING_CONFIG;
}

/**
 * Hook for animated marker with GPS point interpolation
 * Provides smooth animation between GPS updates
 */
export function useAnimatedMarker(options: UseAnimatedMarkerOptions = {}) {
    const {
        animDurationMs = TRACKING_CONFIG.ANIM_DURATION_MS,
        config = TRACKING_CONFIG
    } = options;

    // State
    const [state, setState] = useState<AnimatedMarkerState>({
        position: { lat: 0, lng: 0 },
        bearing: 0,
        isAnimating: false,
    });

    // Refs for animation
    const lastValidPointRef = useRef<GPSPoint | null>(null);
    const targetPointRef = useRef<GPSPoint | null>(null);
    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const startPositionRef = useRef<Coordinates>({ lat: 0, lng: 0 });
    const startBearingRef = useRef<number>(0);
    const targetBearingRef = useRef<number>(0);

    // Trail of recent points (for breadcrumb display)
    const [trail, setTrail] = useState<Coordinates[]>([]);

    /**
     * Animation loop using requestAnimationFrame
     */
    const animate = useCallback(() => {
        if (!targetPointRef.current) return;

        const now = performance.now();
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / animDurationMs, 1);

        // Interpolate position and bearing
        const newPosition = lerpCoordinates(
            startPositionRef.current,
            targetPointRef.current,
            progress
        );
        const newBearing = lerpBearing(
            startBearingRef.current,
            targetBearingRef.current,
            progress
        );

        setState({
            position: newPosition,
            bearing: newBearing,
            isAnimating: progress < 1,
        });

        // Continue animation if not complete
        if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
        } else {
            // Animation complete - update trail
            setTrail(prev => {
                const newTrail = [...prev, newPosition];
                // Keep last 50 points
                return newTrail.slice(-50);
            });
        }
    }, [animDurationMs]);

    /**
     * Add a new GPS point and start animation
     */
    const addPoint = useCallback((point: GPSPoint) => {
        // Validate point
        const validation = isValidGPSPoint(point, lastValidPointRef.current, config);
        if (!validation.valid) {
            console.log(`🚫 GPS point rejected: ${validation.reason}`);
            return false;
        }

        // Cancel any existing animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }

        // Calculate new bearing (only if moved enough)
        let newBearing = state.bearing;
        if (lastValidPointRef.current) {
            const distance = calculateDistance(lastValidPointRef.current, point);
            if (distance >= config.MIN_MOVEMENT_M) {
                newBearing = calculateBearing(lastValidPointRef.current, point);
            }
        }

        // Set up animation
        startPositionRef.current = state.position.lat === 0 ? point : state.position;
        startBearingRef.current = state.bearing;
        targetBearingRef.current = newBearing;
        targetPointRef.current = point;
        startTimeRef.current = performance.now();

        // If first point, set immediately
        if (lastValidPointRef.current === null) {
            setState({
                position: point,
                bearing: newBearing,
                isAnimating: false,
            });
        } else {
            // Start animation
            animationRef.current = requestAnimationFrame(animate);
        }

        lastValidPointRef.current = point;
        return true;
    }, [animate, config, state.bearing, state.position]);

    /**
     * Reset the marker state
     */
    const reset = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
        lastValidPointRef.current = null;
        targetPointRef.current = null;
        setTrail([]);
        setState({
            position: { lat: 0, lng: 0 },
            bearing: 0,
            isAnimating: false,
        });
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, []);

    return {
        position: state.position,
        bearing: state.bearing,
        isAnimating: state.isAnimating,
        trail,
        addPoint,
        reset,
        lastValidPoint: lastValidPointRef.current,
    };
}
