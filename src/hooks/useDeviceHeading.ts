"use client";

import { useState, useEffect, useCallback } from "react";

interface DeviceHeadingState {
    heading: number | null;
    isSupported: boolean;
    error: string | null;
}

/**
 * Hook to get device compass heading (orientation).
 * Uses DeviceOrientationEvent to detect phone rotation.
 * The heading value represents the compass direction (0-360 degrees).
 * 0 = North, 90 = East, 180 = South, 270 = West
 */
export function useDeviceHeading() {
    const [state, setState] = useState<DeviceHeadingState>({
        heading: null,
        isSupported: false,
        error: null,
    });

    const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
        // webkitCompassHeading for iOS, alpha for Android
        let heading: number | null = null;

        // iOS provides webkitCompassHeading directly (0-360)
        if ((event as any).webkitCompassHeading !== undefined) {
            heading = (event as any).webkitCompassHeading;
        }
        // Android uses alpha (but inverted, and needs absolute)
        else if (event.alpha !== null) {
            // alpha: rotation around z-axis (0-360)
            // On Android with absolute: true, alpha is relative to north
            heading = event.alpha;

            // If screen orientation is not portrait, adjust
            if (typeof window !== 'undefined' && window.screen?.orientation?.angle) {
                heading = (heading + window.screen.orientation.angle) % 360;
            }
        }

        if (heading !== null) {
            setState(prev => ({
                ...prev,
                heading: Math.round(heading!),
                isSupported: true,
            }));
        }
    }, []);

    useEffect(() => {
        // Check if DeviceOrientationEvent is supported
        if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
            setState(prev => ({
                ...prev,
                isSupported: false,
                error: "DeviceOrientationEvent not supported",
            }));
            return;
        }

        // iOS 13+ requires permission
        const requestPermission = async () => {
            const DeviceOE = DeviceOrientationEvent as any;

            if (typeof DeviceOE.requestPermission === 'function') {
                try {
                    const permission = await DeviceOE.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('deviceorientationabsolute', handleOrientation as any);
                        window.addEventListener('deviceorientation', handleOrientation);
                        setState(prev => ({ ...prev, isSupported: true }));
                    } else {
                        setState(prev => ({
                            ...prev,
                            error: "Permission denied",
                            isSupported: false,
                        }));
                    }
                } catch (e) {
                    setState(prev => ({
                        ...prev,
                        error: "Failed to request permission",
                        isSupported: false,
                    }));
                }
            } else {
                // Non-iOS or older iOS - just add listener
                // Try absolute first (better for compass)
                window.addEventListener('deviceorientationabsolute', handleOrientation as any, true);
                window.addEventListener('deviceorientation', handleOrientation, true);
                setState(prev => ({ ...prev, isSupported: true }));
            }
        };

        requestPermission();

        return () => {
            window.removeEventListener('deviceorientationabsolute', handleOrientation as any);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [handleOrientation]);

    return state;
}
