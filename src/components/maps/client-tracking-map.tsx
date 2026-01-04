"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2, Crosshair } from "lucide-react";
import dynamic from "next/dynamic";
import { useAnimatedMarker, Coordinates } from "@/hooks/useAnimatedMarker";
import { useFollowCamera } from "@/hooks/useFollowCamera";
import { useSmartRoute } from "@/hooks/useSmartRoute";
import { useServiceDriverLocation } from "@/hooks/useServiceDriverLocation";
import { Button } from "@/components/ui/button";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

// Default center (CDMX) to prevent Null Island (0,0)
const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

/**
 * Helper to check if coords are valid (non-zero)
 */
function isValidCoords(coords?: Coordinates): boolean {
    return !!coords && coords.lat !== 0 && coords.lng !== 0;
}

// Import assets
import CarIcon from "@/assets/map/car-topdown.svg";
import PickupIcon from "@/assets/map/pin-pickup.svg";
import DropoffIcon from "@/assets/map/pin-dropoff.svg";

// Dynamic imports
const Map = dynamic(
    () => import("react-map-gl").then((mod) => mod.Map),
    { ssr: false, loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div> }
);

const Marker = dynamic(() => import("react-map-gl").then((mod) => mod.Marker), { ssr: false });
const Source = dynamic(() => import("react-map-gl").then((mod) => mod.Source), { ssr: false });
const Layer = dynamic(() => import("react-map-gl").then((mod) => mod.Layer), { ssr: false });

interface ClientTrackingMapProps {
    serviceId: string;
    pickupLocation: Coordinates;
    dropoffLocation?: Coordinates;
    serviceStatus: string; // From service_requests.status
    className?: string;
}

/**
 * Map phase from service status
 */
function getPhaseFromStatus(status: string): "pickup" | "trip" {
    return status === "passenger_onboard" || status === "in_trip" ? "trip" : "pickup";
}

/**
 * Client-side tracking map - shows driver's animated position in real-time
 */
export function ClientTrackingMap({
    serviceId,
    pickupLocation,
    dropoffLocation,
    serviceStatus,
    className = "w-full h-96 rounded-xl overflow-hidden",
}: ClientTrackingMapProps) {
    const mapRef = useRef<any>(null);

    // Determine phase based on service status
    const phase = getPhaseFromStatus(serviceStatus);

    // Subscribe to driver's location for this service
    const driverTracking = useServiceDriverLocation({
        serviceId,
        enabled: true,
    });

    // Animated marker for smooth driver movement
    const animatedDriver = useAnimatedMarker();

    // Feed GPS points to animation
    useEffect(() => {
        if (driverTracking.lastLocation) {
            animatedDriver.addPoint(driverTracking.lastLocation);
        }
    }, [driverTracking.lastLocation]);

    // Smart route calculation
    const smartRoute = useSmartRoute({
        driverPosition: isValidCoords(animatedDriver.position) ? animatedDriver.position : null,
        origin: isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER,
        destination: dropoffLocation,
        phase,
    });

    // Camera follow mode
    const followCamera = useFollowCamera({
        mapRef,
        targetPosition: isValidCoords(animatedDriver.position) ? animatedDriver.position : (isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER),
        targetBearing: animatedDriver.bearing,
        enabled: false, // Default off for client
        zoom: 15,
        pitch: 15, // Shallow pitch for client (0-20°)
    });

    // useMapInteractionDetector(mapRef, followCamera.disableFollow);

    // Route layers
    const routeLayer = useMemo(() => ({
        id: "route",
        type: "line" as const,
        paint: {
            "line-color": "#3b82f6",
            "line-width": 5,
            "line-opacity": 0.8,
        },
    }), []);

    const routeBackgroundLayer = useMemo(() => ({
        id: "route-bg",
        type: "line" as const,
        paint: {
            "line-color": "#1e3a8a",
            "line-width": 8,
            "line-opacity": 0.4,
        },
    }), []);

    const routeGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
        type: "FeatureCollection",
        features: smartRoute.route
            ? [{ type: "Feature", properties: {}, geometry: smartRoute.route.geometry }]
            : [],
    }), [smartRoute.route]);

    const displayPosition = isValidCoords(animatedDriver.position) ? animatedDriver.position : (isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER);
    const centerPosition = isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER;

    return (
        <div className={`${className} relative`}>
            <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    longitude: centerPosition.lng,
                    latitude: centerPosition.lat,
                    zoom: 15,
                    pitch: 15,
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle={MAP_STYLE}
                attributionControl={false}
                scrollZoom={true}
                touchZoomRotate={true}
                doubleClickZoom={true}
                dragPan={true}
                onDragStart={() => followCamera.disableFollow()}
                onTouchStart={() => followCamera.disableFollow()}
                onWheel={() => followCamera.disableFollow()}
            >
                {/* Route line */}
                {smartRoute.route && (
                    <Source id="route-source" type="geojson" data={routeGeoJSON}>
                        <Layer {...routeBackgroundLayer} />
                        <Layer {...routeLayer} />
                    </Source>
                )}

                {/* Pickup marker */}
                {phase === "pickup" && (
                    <Marker longitude={pickupLocation.lng} latitude={pickupLocation.lat} anchor="bottom">
                        <div className="relative group">
                            <img src={PickupIcon.src} alt="" className="w-8 h-8" />
                        </div>
                    </Marker>
                )}

                {/* Dropoff marker */}
                {dropoffLocation && phase === "trip" && (
                    <Marker longitude={dropoffLocation.lng} latitude={dropoffLocation.lat} anchor="bottom">
                        <div className="relative group">
                            <img src={DropoffIcon.src} alt="" className="w-8 h-8" />
                        </div>
                    </Marker>
                )}

                {/* Driver marker - Animated */}
                {displayPosition.lat !== 0 && displayPosition.lng !== 0 && (
                    <Marker
                        longitude={displayPosition.lng}
                        latitude={displayPosition.lat}
                        anchor="center"
                        rotation={animatedDriver.bearing}
                    >
                        <div className="relative">
                            {/* Car Icon with shadow */}
                            <div className="drop-shadow-lg">
                                <img src={CarIcon.src} alt="" className="w-9 h-9" />
                            </div>
                        </div>
                    </Marker>
                )}
            </Map>

            {/* Follow button - FAB Style */}
            <div className="absolute top-4 right-4 z-10">
                <Button
                    size="icon"
                    className={`rounded-full w-10 h-10 shadow-md transition-all ${followCamera.isFollowing
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
                        }`}
                    onClick={followCamera.toggleFollow}
                >
                    <Crosshair className={`w-4 h-4 ${followCamera.isFollowing ? "animate-pulse" : ""}`} />
                </Button>
            </div>

            {/* Status overlay removed - will be replaced by RideBottomSheet component */}
        </div>
    );
}
