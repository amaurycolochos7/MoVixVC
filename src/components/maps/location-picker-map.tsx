"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, ArrowLeft, Navigation, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Coordinates, reverseGeocode } from "@/lib/mapbox";

const Map = dynamic(() => import("react-map-gl").then((mod) => mod.Map), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";
// Default to a central location if none provided (e.g. CDMX or user current loc)
const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

interface LocationPickerMapProps {
    initialLocation?: Coordinates | null;
    onConfirm: (location: { coords: Coordinates; address: string; placeName: string }) => void;
    onCancel: () => void;
}

export function LocationPickerMap({ initialLocation, onConfirm, onCancel }: LocationPickerMapProps) {
    const mapRef = useRef<any>(null);
    const [viewState, setViewState] = useState({
        latitude: initialLocation?.lat || DEFAULT_CENTER.lat,
        longitude: initialLocation?.lng || DEFAULT_CENTER.lng,
        zoom: 15
    });

    const [isMoving, setIsMoving] = useState(false);
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);
    const [address, setAddress] = useState<string>("");
    const [placeName, setPlaceName] = useState<string>("Ubicación seleccionada");

    // Fetch address when map stops moving
    const handleMoveEnd = useCallback(async (evt: any) => {
        setIsMoving(false);
        const { latitude, longitude } = evt.viewState;

        // Prevent unnecessary calls if moved very little
        setIsLoadingAddress(true);
        try {
            const result = await reverseGeocode({ lat: latitude, lng: longitude });
            if (result) {
                setAddress(result.fullAddress);
                setPlaceName(result.street || result.neighborhood || "Ubicación en mapa");
            } else {
                setAddress("Dirección desconocida");
                setPlaceName("Ubicación en mapa");
            }
        } catch (error) {
            console.error("Geocoding error:", error);
            setAddress("Error al obtener dirección");
        } finally {
            setIsLoadingAddress(false);
        }
    }, []);

    // Initial load reverse geocode if needed
    useEffect(() => {
        if (initialLocation) {
            handleMoveEnd({ viewState: { latitude: initialLocation.lat, longitude: initialLocation.lng } });
        }
    }, []);

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (mapRef.current) {
                        mapRef.current.flyTo({
                            center: [pos.coords.longitude, pos.coords.latitude],
                            zoom: 15
                        });
                    }
                },
                (err) => console.error(err)
            );
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col h-[100dvh]">
            {/* Header / Back Button - Floating */}
            <div className="absolute top-4 left-4 z-10">
                <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full shadow-lg bg-white text-black hover:bg-gray-100 w-10 h-10"
                    onClick={onCancel}
                >
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative w-full h-full">
                <Map
                    ref={mapRef}
                    {...viewState}
                    onMove={evt => {
                        setViewState(evt.viewState);
                        setIsMoving(true);
                    }}
                    onMoveEnd={handleMoveEnd}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    mapStyle={MAP_STYLE}
                    style={{ width: "100%", height: "100%" }}
                    // Enable all interactions
                    scrollZoom={true}
                    touchZoomRotate={true}
                    doubleClickZoom={true}
                    dragPan={true}
                    attributionControl={false}
                />

                {/* Center Target / PIN */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
                    {/* The Pin */}
                    <div className={`relative transition-transform duration-200 ${isMoving ? "-translate-y-3" : ""}`}>
                        <MapPin className="w-10 h-10 text-primary fill-primary/20 drop-shadow-xl" />
                        {/* Dot at the bottom of pin */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 bg-black rounded-full" />
                    </div>
                    {/* Shadow/Target on the ground */}
                    {!isMoving && (
                        <div className="w-3 h-1 bg-black/30 rounded-full blur-[1px] mt-1" />
                    )}
                </div>

                {/* "Locate Me" Button */}
                <div className="absolute bottom-48 right-4 z-10">
                    <Button
                        size="icon"
                        className="rounded-full shadow-lg bg-white text-gray-700 hover:bg-gray-100 w-12 h-12"
                        onClick={handleLocateMe}
                    >
                        <Navigation className="w-5 h-5" />
                    </Button>
                </div>

                {/* Bottom Floating Card */}
                <div className="absolute bottom-6 left-4 right-4 z-20">
                    <div className="bg-white rounded-2xl shadow-xl p-4 space-y-4 border border-gray-100/50">
                        {/* Status / Instructions */}
                        <div className="flex items-start gap-3">
                            <div className="bg-primary/10 p-2 rounded-full shrink-0">
                                <MapPin className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-0.5">
                                    {isMoving ? "Ubicando..." : "Confirmar destino"}
                                </p>
                                <h3 className="font-semibold text-gray-900 truncate text-base">
                                    {isLoadingAddress ? "Cargando..." : placeName}
                                </h3>
                                <p className="text-sm text-gray-500 truncate">
                                    {isLoadingAddress ? "..." : address}
                                </p>
                            </div>
                        </div>

                        {/* Confirm Button */}
                        <Button
                            className="w-full text-base font-medium h-12 shadow-lg shadow-primary/25 rounded-xl transition-all active:scale-[0.98]"
                            disabled={isLoadingAddress || isMoving}
                            onClick={() => onConfirm({
                                coords: { lat: viewState.latitude, lng: viewState.longitude },
                                address: address,
                                placeName: placeName
                            })}
                        >
                            {isLoadingAddress ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Check className="w-5 h-5 mr-2" />
                            )}
                            Confirmar Ubicación
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
