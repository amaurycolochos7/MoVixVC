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
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12"; // Lighter for better performance

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
import MotoIcon from "@/assets/map/moto-topdown.svg";
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
    trackingStep: string;
    serviceType?: string; // NEW PROP
    className?: string;
}

/**
 * Map phase from tracking_step (matching driver's logic)
 */
function getPhaseFromTrackingStep(trackingStep: string): "pickup" | "trip" {
    // Same logic as driver: picked_up and in_transit mean trip phase
    const tripPhaseSteps = ["picked_up", "in_transit"];
    return tripPhaseSteps.includes(trackingStep) ? "trip" : "pickup";
}

/**
 * Client-side tracking map - shows driver's animated position in real-time
 */
export function ClientTrackingMap({
    serviceId,
    pickupLocation,
    dropoffLocation,
    trackingStep,
    serviceType = 'taxi', // Default to taxi
    className = "w-full h-96 rounded-xl overflow-hidden",
}: ClientTrackingMapProps) {
    const mapRef = useRef<any>(null);

    // Determine phase based on tracking step (matches driver's logic)
    const phase = useMemo(() => {
        const newPhase = getPhaseFromTrackingStep(trackingStep);

        if (process.env.NODE_ENV === "development") {
            console.log(`📍 [ClientTrackingMap] Phase calculation:`, {
                trackingStep,
                phase: newPhase,
                hasDropoff: !!dropoffLocation
            });
        }

        return newPhase;
    }, [trackingStep, dropoffLocation]);

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

    // Force recalculation when phase changes to trip
    useEffect(() => {
        if (phase === "trip" && dropoffLocation) {
            console.log("🔄 [Client] Phase changed to TRIP - forcing route recalculation to dropoff");
            smartRoute.forceRecalculate();
        }
    }, [phase, dropoffLocation]);

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

    // Route layers - Matched to Standard Blue Casing style
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

    const routeGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
        type: "FeatureCollection",
        features: smartRoute.route
            ? [{ type: "Feature", properties: {}, geometry: smartRoute.route.geometry }]
            : [],
    }), [smartRoute.route]);

    const displayPosition = isValidCoords(animatedDriver.position) ? animatedDriver.position : (isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER);
    const centerPosition = isValidCoords(pickupLocation) ? pickupLocation : DEFAULT_CENTER;

    // Choose icon based on service type (moto for mandadito and moto_ride, car for taxi)
    const VehicleIcon = (serviceType === 'mandadito' || serviceType === 'moto_ride') ? MotoIcon : CarIcon;

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
                        <Layer {...routeCasingLayer} />
                        <Layer {...routeInnerLayer} />
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
                        {/* Use branded Moto Ride icon for moto services, SVG for taxi */}
                        {(serviceType === 'moto_ride' || serviceType === 'mandadito') ? (
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
                        ) : (
                            <div className="relative drop-shadow-lg">
                                <img src={VehicleIcon.src} alt="" className="w-10 h-10" />
                            </div>
                        )}
                    </Marker>
                )}
            </Map>

            {/* Recenter button */}
            <div className="absolute top-4 right-4 z-10">
                <Button
                    size="icon"
                    className="rounded-full w-10 h-10 shadow-md transition-all bg-white hover:bg-gray-50 text-orange-600 border-2 border-orange-200"
                    onClick={followCamera.recenter}
                >
                    <Crosshair className="w-4 h-4" />
                </Button>
            </div>

            {/* Status overlay removed - will be replaced by RideBottomSheet component */}
        </div>
    );
}
