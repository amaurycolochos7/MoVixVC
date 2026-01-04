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

// Import assets
import CarIcon from "@/assets/map/car-topdown.svg";
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

export function DriverNavigationMap({
    pickupLocation,
    dropoffLocation,
    driverLocation,
    className = "w-full h-full",
    onRouteMetricsChange,
    trackingStep = "accepted"
}: DriverNavigationMapProps) {
    const mapRef = useRef<any>(null);

    // Animated marker for smooth driver movement
    const animatedDriver = useAnimatedMarker({
        animDurationMs: 2800, // Slightly less than 3s GPS interval
    });

    // Determine phase based on tracking step
    // pickup: accepted, on_the_way, nearby, arrived
    // trip: picked_up, in_transit
    const phase = useMemo(() => {
        if (["picked_up", "in_transit"].includes(trackingStep)) {
            return "trip";
        }
        return "pickup";
    }, [trackingStep]);

    // Smart route calculation
    const smartRoute = useSmartRoute({
        driverPosition: animatedDriver.position.lat !== 0 ? animatedDriver.position : driverLocation || null,
        origin: pickupLocation,
        destination: dropoffLocation,
        phase: phase === "trip" ? "trip" : "pickup",
    });

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

    // Camera target logic:
    // If we have driver location (animated or raw), follow driver.
    // If NOT (waiting for GPS), center on the TARGET destination (Pickup or Dropoff) depending on phase.
    // NEVER fake driver position by centering on client while claiming it's driver.

    const hasDriverLocation = (animatedDriver.position.lat !== 0) || (driverLocation && driverLocation.lat !== 0);

    const cameraTarget = useMemo(() => {
        if (animatedDriver.position.lat !== 0) return animatedDriver.position;
        if (driverLocation && driverLocation.lat !== 0) return driverLocation;

        // Fallback: Target destination
        return phase === "trip" && dropoffLocation ? dropoffLocation : pickupLocation;
    }, [animatedDriver.position, driverLocation, phase, pickupLocation, dropoffLocation]);

    // Camera follow mode
    const followCamera = useFollowCamera({
        mapRef,
        targetPosition: cameraTarget,
        targetBearing: animatedDriver.bearing,
        enabled: hasDriverLocation, // Only follow if we actually have a driver location
        zoom: 16,
        pitch: 35,
    });

    // Detect user interaction to disable follow
    useMapInteractionDetector(mapRef, followCamera.disableFollow);

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

    // Route layer styles
    const routeLayer = useMemo(() => ({
        id: "route",
        type: "line" as const,
        paint: {
            "line-color": "#22c55e",
            "line-width": 6,
            "line-opacity": 0.9,
        },
    }), []);

    const routeBackgroundLayer = useMemo(() => ({
        id: "route-bg",
        type: "line" as const,
        paint: {
            "line-color": "#15803d",
            "line-width": 10,
            "line-opacity": 0.4,
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
                    longitude: pickupLocation.lng,
                    latitude: pickupLocation.lat,
                    zoom: 15,
                    pitch: 35,
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle={MAP_STYLE}
                attributionControl={false}
                logoPosition="bottom-left"
            >
                {/* Route line */}
                {smartRoute.route && (
                    <Source id="route-source" type="geojson" data={routeGeoJSON}>
                        <Layer {...routeBackgroundLayer} />
                        <Layer {...routeLayer} />
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

                {/* Driver marker */}
                {showDriverMarker && (
                    <Marker
                        longitude={animatedDriver.position.lng}
                        latitude={animatedDriver.position.lat}
                        anchor="center"
                        rotation={animatedDriver.bearing}
                    >
                        <div className="relative">
                            <div className="drop-shadow-lg transition-transform duration-500">
                                <img src={CarIcon.src} alt="" className="w-10 h-10" />
                            </div>
                        </div>
                    </Marker>
                )}
            </Map>

            {/* Follow button - Floating Action Button (FAB) Style */}
            <div className="absolute top-24 right-4 z-20">
                <Button
                    size="icon"
                    className={`rounded-full w-12 h-12 shadow-md transition-all ${followCamera.isFollowing
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                        }`}
                    onClick={followCamera.toggleFollow}
                    disabled={!hasDriverLocation} // Disable if no GPS
                >
                    <Crosshair className={`w-5 h-5 ${followCamera.isFollowing ? "animate-pulse" : ""}`} />
                </Button>
            </div>

            {/* Waiting for GPS Banner */}
            {!hasDriverLocation && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur text-white text-xs px-3 py-1 rounded-full pointer-events-none">
                    Esperando GPS...
                </div>
            )}
        </div>
    );
}
