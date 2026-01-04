import { useState, useEffect, useCallback } from "react";

interface LocationState {
    loaded: boolean;
    coordinates?: { lat: number; lng: number };
    error?: { code: number; message: string };
    isRetrying?: boolean;
}

interface UseGeolocationOptions {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    retryOnTimeout?: boolean;
}

/**
 * Robust geolocation hook with automatic retry and fallback
 * - Adjusts timeout and accuracy on failures
 * - Provides retry mechanism
 * - Clear error states for UI feedback
 */
export const useGeolocation = (options: UseGeolocationOptions = {}) => {
    const {
        enableHighAccuracy = true,
        timeout = 20000, // 20 seconds
        maximumAge = 2000, // 2 seconds cache
        retryOnTimeout = true,
    } = options;

    const [location, setLocation] = useState<LocationState>({
        loaded: false,
    });

    const [attemptCount, setAttemptCount] = useState(0);
    const [useHighAccuracy, setUseHighAccuracy] = useState(enableHighAccuracy);

    const onSuccess = useCallback((position: GeolocationPosition) => {
        console.log("✅ GPS Success:", position.coords.latitude, position.coords.longitude);
        setLocation({
            loaded: true,
            coordinates: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            },
        });
        setAttemptCount(0); // Reset on success
    }, []);

    const onError = useCallback((error: GeolocationPositionError) => {
        console.error("❌ GPS Error:", error.code, error.message);

        // Handle timeout with retry logic
        if (error.code === 3 && retryOnTimeout && attemptCount < 2) {
            console.log(`🔄 Timeout, retrying with ${useHighAccuracy ? 'low' : 'standard'} accuracy...`);
            setAttemptCount(prev => prev + 1);

            // On first timeout, try again with lower accuracy
            if (useHighAccuracy && attemptCount === 0) {
                setUseHighAccuracy(false);
                setLocation({
                    loaded: false,
                    isRetrying: true,
                });
                return;
            }
        }

        // Set error state
        setLocation({
            loaded: true,
            error: {
                code: error.code,
                message: getErrorMessage(error.code),
            },
            isRetrying: false,
        });
    }, [attemptCount, useHighAccuracy, retryOnTimeout]);

    const getErrorMessage = (code: number): string => {
        switch (code) {
            case 1:
                return "Permiso de ubicación denegado. Por favor, activa los permisos de ubicación.";
            case 2:
                return "Ubicación no disponible. Verifica tu conexión GPS.";
            case 3:
                return "Sin señal GPS. Tiempo de espera agotado.";
            default:
                return "Error al obtener ubicación.";
        }
    };

    /**
     * Manual retry function
     */
    const retry = useCallback(() => {
        console.log("🔄 Manual retry requested");
        setLocation({ loaded: false, isRetrying: true });
        setAttemptCount(0);
        setUseHighAccuracy(enableHighAccuracy);
    }, [enableHighAccuracy]);

    // Request geolocation
    useEffect(() => {
        if (location.loaded && !location.isRetrying) {
            return; // Already have location or final error
        }

        if (!("geolocation" in navigator)) {
            onError({
                code: 0,
                message: "Geolocation not supported",
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
            } as GeolocationPositionError);
            return;
        }

        console.log(`📍 Requesting GPS (attempt ${attemptCount + 1}, highAccuracy: ${useHighAccuracy})...`);

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onError,
            {
                enableHighAccuracy: useHighAccuracy,
                timeout,
                maximumAge,
            }
        );
    }, [attemptCount, useHighAccuracy, location.loaded, location.isRetrying, onSuccess, onError, timeout, maximumAge]);

    return {
        ...location,
        retry,
    };
};
