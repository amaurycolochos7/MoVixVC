"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapRef } from "react-map-gl";
import { Coordinates, TRACKING_CONFIG, lerpBearing, easeOutCubic } from "./useAnimatedMarker";

interface UseFollowCameraOptions {
    mapRef: React.RefObject<MapRef>;
    targetPosition: Coordinates;
    targetBearing?: number;
    enabled?: boolean;
    zoom?: number;
    pitch?: number;
    transitionDuration?: number;
}

interface FollowCameraState {
    userZoom: number | null; // User's preferred zoom level
    lastRecenter: number;
}

/**
 * Hook for camera following behavior like Uber/Didi
 * ALWAYS follows position but respects user zoom preferences
 * No toggle lock - just a recenter button
 */
export function useFollowCamera(options: UseFollowCameraOptions) {
    const {
        mapRef,
        targetPosition,
        targetBearing = 0,
        enabled = true,
        zoom = TRACKING_CONFIG.DEFAULT_ZOOM,
        pitch = 45,
        transitionDuration = TRACKING_CONFIG.CAMERA_TRANSITION_MS,
    } = options;

    const [state, setState] = useState<FollowCameraState>({
        userZoom: null,
        lastRecenter: 0,
    });

    const animatingRef = useRef(false);
    const lastEaseToRef = useRef<number>(0);

    /**
     * Recenter on current position with default zoom
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

        // Reset user zoom preference
        setState(prev => ({ ...prev, userZoom: null, lastRecenter: Date.now() }));

        setTimeout(() => {
            animatingRef.current = false;
        }, 500);
    }, [mapRef, targetPosition, targetBearing, zoom, pitch]);

    /**
     * Smooth follow - moves camera to position but preserves user zoom
     */
    const smoothFollow = useCallback(() => {
        if (!mapRef.current || animatingRef.current) return;
        if (targetPosition.lat === 0 && targetPosition.lng === 0) return;

        // Throttle to avoid overwhelming the map
        const now = Date.now();
        if (now - lastEaseToRef.current < 200) return;
        lastEaseToRef.current = now;

        // Get current zoom to preserve it
        const currentZoom = mapRef.current.getZoom();
        const currentPitch = mapRef.current.getPitch();

        // Use user's zoom if they've zoomed, otherwise use default
        const targetZoom = state.userZoom ?? zoom;

        mapRef.current.easeTo({
            center: [targetPosition.lng, targetPosition.lat],
            zoom: targetZoom,
            bearing: targetBearing,
            pitch: currentPitch || pitch,
            duration: transitionDuration,
            easing: easeOutCubic,
        });
    }, [mapRef, targetPosition, targetBearing, zoom, pitch, transitionDuration, state.userZoom]);

    /**
     * Initial center (instant, no animation)
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

    // Always follow target when position changes
    useEffect(() => {
        if (enabled) {
            smoothFollow();
        }
    }, [targetPosition.lat, targetPosition.lng, targetBearing, enabled, smoothFollow]);

    // Legacy compatibility - these do nothing now but prevent errors
    const enableFollow = useCallback(() => { }, []);
    const disableFollow = useCallback(() => {
        // When user interacts, save their zoom level
        if (mapRef.current) {
            const currentZoom = mapRef.current.getZoom();
            setState(prev => ({ ...prev, userZoom: currentZoom }));
        }
    }, [mapRef]);
    const toggleFollow = recenter; // Toggle now just recenters

    return {
        isFollowing: true, // Always following
        enableFollow,
        disableFollow,
        toggleFollow,
        centerOnTarget,
        flyToTarget: smoothFollow,
        recenter,
        isAnimating: animatingRef.current,
    };
}

/**
 * Hook to detect user interaction with the map
 * Disables follow mode when user drags/pinches the map
 */
export function useMapInteractionDetector(
    mapRef: React.RefObject<MapRef>,
    onUserInteraction: () => void
) {
    useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const handleInteraction = () => onUserInteraction();

        // Listen for all user interactions
        map.on('dragstart', handleInteraction);
        map.on('wheel', handleInteraction);
        map.on('pitchstart', handleInteraction);
        map.on('touchstart', handleInteraction); // Fix for mobile zoom/pan
        map.on('mousedown', handleInteraction); // Fix for desktop drag click

        return () => {
            map.off('dragstart', handleInteraction);
            map.off('wheel', handleInteraction);
            map.off('pitchstart', handleInteraction);
            map.off('touchstart', handleInteraction);
            map.off('mousedown', handleInteraction);
        };
    }, [mapRef, onUserInteraction]);
}
