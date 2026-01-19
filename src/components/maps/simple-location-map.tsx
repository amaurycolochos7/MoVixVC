"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface SimpleLocationMapProps {
    lat: number;
    lng: number;
    markerColor?: string;
}

export function SimpleLocationMap({ lat, lng, markerColor = "#3b82f6" }: SimpleLocationMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        // Check if Mapbox token is available
        const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
        if (!token) {
            setError("Token de Mapbox no configurado");
            return;
        }

        try {
            mapboxgl.accessToken = token;

            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: "mapbox://styles/mapbox/streets-v12",
                center: [lng, lat],
                zoom: 15,
                interactive: true,
                attributionControl: false,
            });

            // Add marker
            new mapboxgl.Marker({ color: markerColor })
                .setLngLat([lng, lat])
                .addTo(map.current);

        } catch (err) {
            setError("Error al cargar el mapa");
            console.error("Map error:", err);
        }

        return () => {
            map.current?.remove();
            map.current = null;
        };
    }, [lat, lng, markerColor]);

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="text-center p-4">
                    <p className="text-sm text-gray-600">{error}</p>
                    <p className="text-xs text-gray-400 mt-2">
                        Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={mapContainer} className="w-full h-full rounded-none" />
    );
}
