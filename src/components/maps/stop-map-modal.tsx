"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, X, Navigation, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFollowCamera, useMapInteractionDetector } from '@/hooks/useFollowCamera';

// Static import for types, dynamic for usage
import type { MapRef } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';

const Map = dynamic(() => import("react-map-gl").then((mod) => mod.Map), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
});

const Marker = dynamic(() => import("react-map-gl").then((mod) => mod.Marker), { ssr: false });
const Source = dynamic(() => import("react-map-gl").then((mod) => mod.Source), { ssr: false });
const Layer = dynamic(() => import("react-map-gl").then((mod) => mod.Layer), { ssr: false });

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface StopMapModalProps {
    lat: number;
    lng: number;
    title?: string;
    driverLocation?: { lat: number; lng: number } | null;
    onClose: () => void;
}

export function StopMapModal({ lat, lng, title, driverLocation, onClose }: StopMapModalProps) {
    const mapRef = React.useRef<MapRef>(null);
    const [routeGeoJSON, setRouteGeoJSON] = React.useState<any>(null);

    // Initialize follow camera hook
    const followCamera = useFollowCamera({
        mapRef,
        targetPosition: driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : { lat: 0, lng: 0 },
        enabled: false, // Start disabled, wait for user to click "Start"
        zoom: 17,
        pitch: 50
    });

    // Disable follow on manual interaction - including touch
    React.useEffect(() => {
        const map = mapRef.current?.getMap();
        if (!map) return;

        const disable = () => followCamera.disableFollow();

        map.on('dragstart', disable);
        map.on('wheel', disable);
        map.on('pitchstart', disable);
        map.on('touchstart', disable); // Add touchstart for mobile responsiveness

        return () => {
            map.off('dragstart', disable);
            map.off('wheel', disable);
            map.off('pitchstart', disable);
            map.off('touchstart', disable);
        };
    }, [mapRef, followCamera.disableFollow]);

    // Fetch route when modal opens and we have both locations
    React.useEffect(() => {
        if (!lat || !lng || !driverLocation) return;

        const fetchRoute = async () => {
            try {
                // driving-traffic + overview=full for high precision
                const query = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${driverLocation.lng},${driverLocation.lat};${lng},${lat}?steps=true&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`
                );
                const json = await query.json();

                if (json.routes && json.routes.length > 0) {
                    const route = json.routes[0];
                    setRouteGeoJSON({
                        type: 'Feature',
                        properties: {},
                        geometry: route.geometry
                    });

                    // Initial bounds: Show entire route
                    setTimeout(() => {
                        if (mapRef.current) {
                            const bounds = new mapboxgl.LngLatBounds()
                                .extend([driverLocation.lng, driverLocation.lat])
                                .extend([lng, lat]);

                            mapRef.current.fitBounds(bounds, {
                                padding: 50,
                                duration: 1000
                            });
                        }
                    }, 500);
                }
            } catch (err) {
                console.error("Error fetching route:", err);
            }
        };

        fetchRoute();
    }, [lat, lng, driverLocation]);

    if (!lat || !lng) return null;

    const handleStartNavigation = () => {
        // Center on driver and enable follow mode
        if (driverLocation) {
            followCamera.centerOnTarget();
            followCamera.enableFollow();
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[600px]">

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                    <span className="bg-white/90 text-gray-900 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg backdrop-blur">
                        {title || "Ubicación de compra"}
                    </span>
                    <button
                        onClick={onClose}
                        className="pointer-events-auto bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur transition border border-white/10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-slate-100">
                    <Map
                        ref={mapRef}
                        initialViewState={{
                            longitude: lng,
                            latitude: lat,
                            zoom: 15
                        }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle="mapbox://styles/mapbox/streets-v12"
                        mapboxAccessToken={MAPBOX_TOKEN}
                    >
                        {/* Route Line */}
                        {routeGeoJSON && (
                            <Source id="route-source" type="geojson" data={routeGeoJSON}>
                                <Layer
                                    id="route-layer-casing"
                                    type="line"
                                    layout={{ "line-join": "round", "line-cap": "round" }}
                                    paint={{
                                        "line-color": "#1e40af",
                                        "line-width": 8,
                                        "line-opacity": 0.8
                                    }}
                                />
                                <Layer
                                    id="route-layer-inner"
                                    type="line"
                                    layout={{ "line-join": "round", "line-cap": "round" }}
                                    paint={{
                                        "line-color": "#3b82f6",
                                        "line-width": 5,
                                        "line-opacity": 1
                                    }}
                                />
                            </Source>
                        )}

                        {/* Destination Marker */}
                        <Marker latitude={lat} longitude={lng}>
                            <div className="relative flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white shadow-xl flex items-center justify-center animate-bounce">
                                    <div className="w-3 h-3 rounded-full bg-white" />
                                </div>
                                <div className="w-1 h-3 bg-orange-500" />
                            </div>
                        </Marker>

                        {/* Driver Marker */}
                        {driverLocation && (
                            <Marker latitude={driverLocation.lat} longitude={driverLocation.lng}>
                                <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                </div>
                            </Marker>
                        )}

                        {/* Follow Mode Indicator */}
                        {followCamera.isFollowing && (
                            <div className="absolute bottom-6 right-4 bg-blue-600/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse flex items-center gap-1.5 border border-white/20">
                                <Navigation className="w-3 h-3" />
                                Navegando
                            </div>
                        )}

                        {/* Recenter Button (FAB) - Shows when NOT following but driver location exists */}
                        {!followCamera.isFollowing && driverLocation && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    followCamera.centerOnTarget();
                                    followCamera.enableFollow();
                                }}
                                className="absolute bottom-24 right-4 w-12 h-12 bg-white rounded-full shadow-xl border border-gray-100 flex items-center justify-center text-blue-600 hover:bg-slate-50 active:scale-95 transition-all z-20"
                            >
                                <Navigation className="w-5 h-5" />
                            </button>
                        )}
                    </Map>
                </div>

                {/* Footer Controls */}
                <div className="p-5 bg-white border-t border-gray-100 space-y-3 z-20">
                    <Button
                        className={`w-full h-12 font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all duration-300 ${followCamera.isFollowing
                            ? "bg-green-600 hover:bg-green-700 text-white ring-2 ring-green-200 ring-offset-2"
                            : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                        onClick={handleStartNavigation}
                    >
                        <Navigation className={`h-5 w-5 ${followCamera.isFollowing ? "animate-pulse" : ""}`} />
                        {followCamera.isFollowing ? "Navegando hacia el destino..." : "Iniciar navegación"}
                    </Button>

                    <Button
                        variant="outline"
                        className="w-full h-12 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 font-semibold text-lg flex items-center justify-center gap-2"
                        onClick={onClose}
                    >
                        <CheckCircle className="h-5 w-5" />
                        Ya llegué al destino
                    </Button>
                </div>
            </div>
        </div>
    );
}
