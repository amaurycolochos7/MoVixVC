"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2, Crosshair } from "lucide-react";
import dynamic from "next/dynamic";
import { useAnimatedMarker, GPSPoint, Coordinates } from "@/hooks/useAnimatedMarker";
import { useFollowCamera, useMapInteractionDetector } from "@/hooks/useFollowCamera";
import { useSmartRoute } from "@/hooks/useSmartRoute";
import { Button } from "@/components/ui/button";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/navigation-day-v1";

// Default center (CDMX) to prevent Null Island (0,0)
const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

export interface DriverNavigationMapRef {
    startNavigation: () => void;
}


/**
 * Helper to check if coords are valid (non-zero)
 */
function isValidCoords(coords?: Coordinates | null): boolean {
    return !!coords && coords.lat !== 0 && coords.lng !== 0;
}

// Import assets
import CarIcon from "@/assets/map/moto-topdown.svg";
import PickupIcon from "@/assets/map/pin-pickup.svg";

// Dynamic imports to avoid SSR issues
const Map = dynamic(
    () => import("react-map-gl").then((mod) => mod.Map),
    { ssr: false, loading: () => <MapLoading /> }
);

const Marker = dynamic(
    () => import("react-map-gl").then((mod) => mod.Marker),
    { ssr: false }
);

const Source = dynamic(
    () => import("react-map-gl").then((mod) => mod.Source),
    { ssr: false }
);

const Layer = dynamic(
    () => import("react-map-gl").then((mod) => mod.Layer),
    { ssr: false }
);

function MapLoading() {
    return (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="w-8 h-8 text-green-400 animate-spin mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Cargando mapa...</p>
            </div>
        </div>
    );
}

interface DriverNavigationMapProps {
    pickupLocation: Coordinates;
    dropoffLocation?: Coordinates;
    driverLocation?: Coordinates;
    className?: string;
    onRouteMetricsChange?: (metrics: { eta: number; distance: number; isOffRoute: boolean }) => void;
    trackingStep?: string;
}

import { forwardRef, useImperativeHandle } from "react";

export const DriverNavigationMap = forwardRef<DriverNavigationMapRef, DriverNavigationMapProps>(({
    pickupLocation,
    dropoffLocation,
    driverLocation,
    className = "w-full h-full",
    onRouteMetricsChange,
    trackingStep = "accepted"
}, ref) => {
    const mapRef = useRef<any>(null);

    // Animated marker for smooth driver movement
    const animatedDriver = useAnimatedMarker({
        animDurationMs: 2800, // Slightly less than 3s GPS interval
    });

    // Determine phase based on tracking step
    // pickup: accepted, on_the_way, nearby, arrived
    // trip: picked_up, in_transit
    const phase = useMemo(() => {
        const newPhase = ["picked_up", "in_transit"].includes(trackingStep) ? "trip" : "pickup";
        return newPhase;
    }, [trackingStep, dropoffLocation]);

    // Smart route calculation
    const smartRoute = useSmartRoute({
        driverPosition: isValidCoords(animatedDriver.position) ? animatedDriver.position : (isValidCoords(driverLocation) ? driverLocation! : null),
        origin: isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER,
        destination: dropoffLocation || undefined,
        phase: phase === "trip" ? "trip" : "pickup",
    });

    // Force recalculation when phase changes
    useEffect(() => {
        if (phase === "trip" && dropoffLocation) {
            console.log("🔄 Phase changed to TRIP - forcing route recalculation to dropoff");
            smartRoute.forceRecalculate();
        }
    }, [phase, dropoffLocation]);

    // Notify parent of metrics changes
    useEffect(() => {
        if (onRouteMetricsChange && smartRoute.eta !== undefined) {
            onRouteMetricsChange({
                eta: smartRoute.eta,
                distance: smartRoute.distance,
                isOffRoute: smartRoute.isOffRoute
            });
        }
    }, [smartRoute.eta, smartRoute.distance, smartRoute.isOffRoute, onRouteMetricsChange]);

    // Camera target logic
    const hasDriverLocation = (animatedDriver.position.lat !== 0) || (driverLocation && driverLocation.lat !== 0);

    const cameraTarget = useMemo(() => {
        if (isValidCoords(animatedDriver.position)) return animatedDriver.position;
        if (isValidCoords(driverLocation)) return driverLocation!;
        const target = phase === "trip" && dropoffLocation ? dropoffLocation : pickupLocation;
        return isValidCoords(target) ? target : DEFAULT_CENTER;
    }, [animatedDriver.position, driverLocation, phase, pickupLocation, dropoffLocation]);

    // Camera follow mode - 3D navigation view with auto-rotation
    const followCamera = useFollowCamera({
        mapRef,
        targetPosition: cameraTarget,
        targetBearing: animatedDriver.bearing, // Follow rotation - map rotates with driver heading
        enabled: hasDriverLocation,
        zoom: 17, // Closer zoom for navigation
        pitch: 45, // 3D perspective for better orientation
    });

    // Detect user interaction to disable follow
    useMapInteractionDetector(mapRef, followCamera.disableFollow);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        startNavigation: () => {
            if (mapRef.current) {
                // Pitch 50 + Zoom 17 for navigation view
                mapRef.current.easeTo({
                    pitch: 50,
                    zoom: 17,
                    bearing: animatedDriver.bearing,
                    duration: 1000
                });
                // Enable following with strict locking
                setTimeout(() => {
                    followCamera.enableFollow();
                }, 1000); // Wait for transition
            }
        }
    }));


    // Feed GPS points to animated marker
    useEffect(() => {
        if (driverLocation && driverLocation.lat !== 0 && driverLocation.lng !== 0) {
            const gpsPoint: GPSPoint = {
                ...driverLocation,
                timestamp: Date.now(),
                accuracy: 20, // Assume good accuracy for now
            };

            const accepted = animatedDriver.addPoint(gpsPoint);
            // Log suppressed to reduce noise, rely on hook logs
        }
    }, [driverLocation, animatedDriver]);

    // Route layer styles - Matched to StopMapModal (Blue Casing)
    const routeInnerLayer = useMemo(() => ({
        id: "route-inner",
        type: "line" as const,
        layout: {
            "line-join": "round" as const,
            "line-cap": "round" as const
        },
        paint: {
            "line-color": "#3b82f6", // Bright blue
            "line-width": 5,
            "line-opacity": 1,
        },
    }), []);

    const routeCasingLayer = useMemo(() => ({
        id: "route-casing",
        type: "line" as const,
        layout: {
            "line-join": "round" as const,
            "line-cap": "round" as const
        },
        paint: {
            "line-color": "#1e40af", // Darker blue border
            "line-width": 8,
            "line-opacity": 0.8,
        },
    }), []);

    const trailLayer = useMemo(() => ({
        id: "trail",
        type: "line" as const,
        paint: {
            "line-color": "#3b82f6",
            "line-width": 4,
            "line-opacity": 0.5,
            "line-dasharray": [1, 2],
        },
    }), []);

    const routeGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
        type: "FeatureCollection",
        features: smartRoute.route
            ? [{ type: "Feature", properties: {}, geometry: smartRoute.route.geometry }]
            : [],
    }), [smartRoute.route]);

    const trailGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
        type: "FeatureCollection",
        features: animatedDriver.trail.length > 1 ? [{
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: animatedDriver.trail.map(p => [p.lng, p.lat]),
            },
        }] : [],
    }), [animatedDriver.trail]);

    if (!MAPBOX_TOKEN) {
        return (
            <div className={`${className} bg-gray-800 flex items-center justify-center`}>
                <p className="text-white text-sm">Token de Mapbox no configurado</p>
            </div>
        );
    }

    // Only show driver marker if we actually have position
    const showDriverMarker = hasDriverLocation;

    return (
        <div className={`${className} relative`}>
            <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    longitude: cameraTarget.lng,
                    latitude: cameraTarget.lat,
                    zoom: 17,
                    pitch: 45, // 3D navigation view
                    bearing: 0, // Will be controlled by followCamera
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle={MAP_STYLE}
                attributionControl={false}
                logoPosition="bottom-left"
                scrollZoom={true}
                touchZoomRotate={true} // Allow touch zoom and rotation
                touchPitch={true} // Allow pitch with touch
                doubleClickZoom={true}
                dragPan={true}
                dragRotate={true} // Allow rotation with drag
                pitchWithRotate={true}
                keyboard={false} // Disable keyboard shortcuts
                maxPitch={60}
                minPitch={0}
            >
                {/* Route line */}
                {smartRoute.route && (
                    <Source id="route-source" type="geojson" data={routeGeoJSON}>
                        <Layer {...routeCasingLayer} />
                        <Layer {...routeInnerLayer} />
                    </Source>
                )}

                {/* Trail/breadcrumbs */}
                {animatedDriver.trail.length > 1 && (
                    <Source id="trail-source" type="geojson" data={trailGeoJSON}>
                        <Layer {...trailLayer} />
                    </Source>
                )}

                {/* Pickup Marker (Always show, maybe different icon if visited?) */}
                <Marker longitude={pickupLocation.lng} latitude={pickupLocation.lat} anchor="bottom">
                    <div className="relative group">
                        {/* Pickup Pin - Green */}
                        <img src={PickupIcon.src} alt="Pickup" className="w-8 h-8" />
                    </div>
                </Marker>

                {/* Dropoff Marker (Only show if we have one) */}
                {dropoffLocation && (
                    <Marker longitude={dropoffLocation.lng} latitude={dropoffLocation.lat} anchor="bottom">
                        <div className="relative group">
                            {/* Dropoff Pin - Red/Purple (TODO: Import correct icon if separate) */}
                            {/* For now reusing PickupIcon but could be a different one if imported */}
                            <img src={PickupIcon.src} alt="Dropoff" className="w-8 h-8 hue-rotate-180" />
                        </div>
                    </Marker>
                )}

                {/* Driver marker - Moto Ride branded icon */}
                {showDriverMarker && (
                    <Marker
                        longitude={animatedDriver.position.lng}
                        latitude={animatedDriver.position.lat}
                        anchor="center"
                        rotation={animatedDriver.bearing}
                    >
                        <div className="relative">
                            {/* Glowing pulse effect */}
                            <div className="absolute inset-0 w-12 h-12 rounded-full bg-orange-400/30 animate-ping" style={{ animationDuration: '2s' }} />
                            {/* Main icon container */}
                            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg flex items-center justify-center border-2 border-white">
                                <img
                                    src="/moto-ride.png"
                                    alt="Moto Ride"
                                    className="w-8 h-8 object-contain"
                                />
                            </div>
                        </div>
                    </Marker>
                )}
            </Map>

            {/* Map controls - Right side */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
                {/* Recenter Button - Centers map on current position or pickup */}
                <Button
                    size="icon"
                    className="rounded-full w-11 h-11 shadow-lg active:scale-95 transition-all bg-white hover:bg-gray-50 text-orange-600 border-2 border-orange-200"
                    onClick={followCamera.recenter}
                    title="Centrar en mi ubicación"
                >
                    <Crosshair className="w-5 h-5" />
                </Button>
            </div>

            {/* Waiting for GPS Banner */}
            {!hasDriverLocation && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur text-white text-xs px-4 py-2 rounded-full pointer-events-none flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                    Obteniendo GPS...
                </div>
            )}
        </div>
    );
}); // Close forwardRef component
