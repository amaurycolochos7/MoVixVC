"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapRef } from "react-map-gl";
import { Coordinates, TRACKING_CONFIG, easeOutCubic } from "./useAnimatedMarker";

interface UseFollowCameraOptions {
    mapRef: React.RefObject<MapRef>;
    targetPosition: Coordinates;
    targetBearing?: number;
    enabled?: boolean;
    zoom?: number;
    pitch?: number;
    transitionDuration?: number;
}

/**
 * Hook for camera following behavior
 * - By default does NOT auto-follow (user has full control)
 * - Recenter button moves camera to current position
 * - User can freely zoom/pan without interference
 */
export function useFollowCamera(options: UseFollowCameraOptions) {
    const {
        mapRef,
        targetPosition,
        targetBearing = 0,
        enabled = true,
        zoom = TRACKING_CONFIG.DEFAULT_ZOOM,
        pitch = 45,
    } = options;

    // Use ref to track pause state to avoid closure issues
    const isPausedRef = useRef(true); // Start paused - user has control
    const [isPaused, setIsPaused] = useState(true);
    const animatingRef = useRef(false);

    /**
     * Recenter on current position
     * Called when user clicks the recenter button
     */
    const recenter = useCallback(() => {
        if (!mapRef.current) return;
        if (targetPosition.lat === 0 && targetPosition.lng === 0) return;

        animatingRef.current = true;

        mapRef.current.easeTo({
            center: [targetPosition.lng, targetPosition.lat],
            zoom,
            bearing: targetBearing,
            pitch,
            duration: 500,
            easing: easeOutCubic,
        });

        // DO NOT resume auto-follow after recentering
        // User still has full control, they just centered the view

        setTimeout(() => {
            animatingRef.current = false;
        }, 500);
    }, [mapRef, targetPosition, targetBearing, zoom, pitch]);

    /**
     * Initial center (instant, no animation) - used only on mount
     */
    const centerOnTarget = useCallback(() => {
        if (!mapRef.current) return;
        if (targetPosition.lat === 0 && targetPosition.lng === 0) return;

        mapRef.current.jumpTo({
            center: [targetPosition.lng, targetPosition.lat],
            zoom,
            bearing: targetBearing,
            pitch,
        });
    }, [mapRef, targetPosition, targetBearing, zoom, pitch]);

    // Center once when we first get valid coordinates
    const hasCenteredRef = useRef(false);
    useEffect(() => {
        if (!hasCenteredRef.current && enabled && targetPosition.lat !== 0 && targetPosition.lng !== 0) {
            centerOnTarget();
            hasCenteredRef.current = true;
        }
    }, [targetPosition.lat, targetPosition.lng, enabled, centerOnTarget]);

    // Pause follow - called when user interacts
    const disableFollow = useCallback(() => {
        isPausedRef.current = true;
        setIsPaused(true);
    }, []);

    // Resume follow - currently not used, but kept for compatibility
    const enableFollow = useCallback(() => {
        isPausedRef.current = false;
        setIsPaused(false);
    }, []);

    return {
        isFollowing: false, // We never auto-follow now
        isPaused: true, // Always paused - user has full control
        enableFollow,
        disableFollow,
        toggleFollow: recenter,
        centerOnTarget,
        flyToTarget: recenter,
        recenter,
        isAnimating: animatingRef.current,
    };
}

/**
 * Hook to detect user interaction with the map
 * Now essentially a no-op since we don't auto-follow anymore
 */
export function useMapInteractionDetector(
    mapRef: React.RefObject<MapRef>,
    onUserInteraction: () => void
) {
    // No-op - we don't need to detect interactions since we don't auto-follow
    useEffect(() => {
        // Intentionally empty - user always has control
    }, [mapRef, onUserInteraction]);
}
