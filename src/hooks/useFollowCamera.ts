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
    isFollowing: boolean;
    lastUserInteraction: number;
}

/**
 * Hook for camera following behavior like Uber/Didi
 * Smoothly follows the target position with configurable zoom and pitch
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
        isFollowing: enabled,
        lastUserInteraction: 0,
    });

    const animatingRef = useRef(false);
    const lastEaseToRef = useRef<number>(0);

    /**
     * Enable follow mode
     */
    const enableFollow = useCallback(() => {
        setState(prev => ({ ...prev, isFollowing: true }));
    }, []);

    /**
     * Disable follow mode (when user pans manually)
     */
    const disableFollow = useCallback(() => {
        setState(prev => ({
            ...prev,
            isFollowing: false,
            lastUserInteraction: Date.now(),
        }));
    }, []);

    /**
     * Toggle follow mode
     */
    const toggleFollow = useCallback(() => {
        setState(prev => ({
            ...prev,
            isFollowing: !prev.isFollowing,
        }));
    }, []);

    /**
     * Move camera to target with smooth transition
     */
    const flyToTarget = useCallback(() => {
        if (!mapRef.current || !state.isFollowing) return;
        if (targetPosition.lat === 0 && targetPosition.lng === 0) return;

        // Throttle easeTo calls to avoid overwhelming the map
        const now = Date.now();
        if (now - lastEaseToRef.current < 100) return;
        lastEaseToRef.current = now;

        animatingRef.current = true;

        mapRef.current.easeTo({
            center: [targetPosition.lng, targetPosition.lat],
            zoom,
            bearing: targetBearing,
            pitch,
            duration: transitionDuration,
            easing: easeOutCubic,
        });

        setTimeout(() => {
            animatingRef.current = false;
        }, transitionDuration);
    }, [mapRef, targetPosition, targetBearing, zoom, pitch, transitionDuration, state.isFollowing]);

    /**
     * Initial center on target (instant, no animation)
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

        setState(prev => ({ ...prev, isFollowing: true }));
    }, [mapRef, targetPosition, targetBearing, zoom, pitch]);

    // Follow target when position changes
    useEffect(() => {
        if (state.isFollowing && enabled) {
            flyToTarget();
        }
    }, [targetPosition.lat, targetPosition.lng, state.isFollowing, enabled, flyToTarget]);

    return {
        isFollowing: state.isFollowing,
        enableFollow,
        disableFollow,
        toggleFollow,
        centerOnTarget,
        flyToTarget,
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
