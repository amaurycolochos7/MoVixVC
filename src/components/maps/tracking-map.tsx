"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, Source, MapRef } from "react-map-gl";
import { Car, MapPin, Navigation } from "lucide-react";
import { getRoute, calculateBearing, Coordinates, RouteResult } from "@/lib/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

// Outdoors style - detailed terrain, buildings, parks, and POIs
const MAP_STYLE = "mapbox://styles/mapbox/outdoors-v12";

interface TrackingMapProps {
    /** Client pickup location */
    origin: Coordinates;
    /** Trip destination */
    destination: Coordinates;
    /** Driver's current location (real-time) */
    driverLocation?: Coordinates;
    /** Trip status to determine what to show */
    status: "searching" | "driver_on_way" | "arrived" | "in_trip" | "completed";
    /** Optional className for container */
    className?: string;
}

/**
 * Professional tracking map component using Mapbox.
 * Shows route, markers, and animated driver position.
 */
export function TrackingMap({
    origin,
    destination,
    driverLocation,
    status,
    className = "w-full h-64 rounded-xl overflow-hidden",
}: TrackingMapProps) {
    const mapRef = useRef<MapRef>(null);
    const [route, setRoute] = useState<RouteResult | null>(null);
    const [bearing, setBearing] = useState(0);

    // Determine which points to show route between
    const routePoints = useMemo(() => {
        if (status === "driver_on_way" && driverLocation) {
            // Driver going to pickup
            return { start: driverLocation, end: origin };
        } else if (status === "in_trip") {
            // Trip in progress: origin to destination
            return { start: origin, end: destination };
        }
        // Default: show full trip route
        return { start: origin, end: destination };
    }, [status, driverLocation, origin, destination]);

    // Fetch route when points change
    useEffect(() => {
        async function fetchRoute() {
            const result = await getRoute(routePoints.start, routePoints.end);
            setRoute(result);
        }
        fetchRoute();
    }, [routePoints]);

    // Update bearing when driver moves
    useEffect(() => {
        if (driverLocation && origin) {
            const newBearing = calculateBearing(driverLocation, origin);
            setBearing(newBearing);
        }
    }, [driverLocation, origin]);

    // Fit bounds to show all markers
    const fitBounds = useCallback(() => {
        if (!mapRef.current) return;

        const points = [origin, destination];
        if (driverLocation) points.push(driverLocation);

        const lngs = points.map((p) => p.lng);
        const lats = points.map((p) => p.lat);

        mapRef.current.fitBounds(
            [
                [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
                [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01],
            ],
            { padding: 50, duration: 1000 }
        );
    }, [origin, destination, driverLocation]);

    useEffect(() => {
        const timer = setTimeout(fitBounds, 500);
        return () => clearTimeout(timer);
    }, [fitBounds]);

    // Route layer style
    const routeLayer = {
        id: "route",
        type: "line" as const,
        paint: {
            "line-color": "#3b82f6",
            "line-width": 5,
            "line-opacity": 0.8,
        },
    };

    // Route background (shadow effect)
    const routeBackgroundLayer = {
        id: "route-bg",
        type: "line" as const,
        paint: {
            "line-color": "#1e3a5f",
            "line-width": 8,
            "line-opacity": 0.4,
        },
    };

    const routeGeoJSON: GeoJSON.FeatureCollection = useMemo(() => ({
        type: "FeatureCollection",
        features: route
            ? [
                {
                    type: "Feature",
                    properties: {},
                    geometry: route.geometry,
                },
            ]
            : [],
    }), [route]);

    if (!MAPBOX_TOKEN) {
        return (
            <div className={`${className} bg-gray-900 flex items-center justify-center`}>
                <p className="text-white text-sm">Mapbox token no configurado</p>
            </div>
        );
    }

    return (
        <div className={className}>
            <Map
                ref={mapRef}
                mapboxAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    longitude: origin.lng,
                    latitude: origin.lat,
                    zoom: 14,
                }}
                style={{ width: "100%", height: "100%" }}
                mapStyle={MAP_STYLE}
                attributionControl={false}
            >
                {/* Route */}
                {route && (
                    <Source id="route-source" type="geojson" data={routeGeoJSON}>
                        <Layer {...routeBackgroundLayer} />
                        <Layer {...routeLayer} />
                    </Source>
                )}

                {/* Origin Marker (Pickup) */}
                <Marker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
                    <div className="relative">
                        <div className="w-10 h-10 bg-blue-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center animate-pulse">
                            <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap font-semibold">
                            Origen
                        </div>
                    </div>
                </Marker>

                {/* Destination Marker */}
                <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
                    <div className="relative">
                        <div className="w-10 h-10 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                            <Navigation className="w-5 h-5 text-white" />
                        </div>
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap font-semibold">
                            Destino
                        </div>
                    </div>
                </Marker>

                {/* Driver Marker */}
                {driverLocation && status !== "completed" && (
                    <Marker
                        longitude={driverLocation.lng}
                        latitude={driverLocation.lat}
                        anchor="center"
                        rotation={bearing}
                    >
                        <div className="relative">
                            {/* Pulse effect */}
                            <div className="absolute inset-0 w-14 h-14 -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 bg-yellow-400/30 rounded-full animate-ping" />
                            {/* Car container */}
                            <div className="w-12 h-12 bg-yellow-400 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
                                <Car className="w-6 h-6 text-gray-900" />
                            </div>
                            {/* Live indicator */}
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                        </div>
                    </Marker>
                )}
            </Map>

            {/* ETA Overlay */}
            {route && status !== "completed" && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 flex justify-between items-center">
                    <div>
                        <p className="text-white font-bold text-lg">
                            {Math.round(route.duration / 60)} min
                        </p>
                        <p className="text-gray-300 text-sm">
                            {(route.distance / 1000).toFixed(1)} km
                        </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${status === "arrived"
                        ? "bg-green-500 text-white"
                        : status === "driver_on_way"
                            ? "bg-yellow-400 text-gray-900"
                            : "bg-blue-500 text-white"
                        }`}>
                        {status === "arrived"
                            ? "Conductor llegó"
                            : status === "driver_on_way"
                                ? "En camino"
                                : status === "in_trip"
                                    ? "En viaje"
                                    : "Buscando..."}
                    </div>
                </div>
            )}
        </div>
    );
}
