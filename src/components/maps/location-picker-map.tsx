"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, ArrowLeft, Navigation, Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coordinates, reverseGeocode, forwardGeocode, ForwardGeocodeResult } from "@/lib/mapbox";

const Map = dynamic(() => import("react-map-gl").then((mod) => mod.Map), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
const MAP_STYLE = "mapbox://styles/mapbox/outdoors-v12";
// Default to Venustiano Carranza, Chiapas (CP 30200) - Centro
const DEFAULT_CENTER = { lat: 16.3396, lng: -92.5651 };

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

    // Search states
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<ForwardGeocodeResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Handle search with debounce
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim().length < 3) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            const results = await forwardGeocode(searchQuery);
            setSearchResults(results);
            setShowSearchResults(results.length > 0);
            setIsSearching(false);
        }, 500); // 500ms debounce

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    // Handle selecting a search result
    const handleSelectSearchResult = (result: ForwardGeocodeResult) => {
        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [result.coords.lng, result.coords.lat],
                zoom: 16
            });
        }
        setSearchQuery("");
        setShowSearchResults(false);
        setSearchResults([]);
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

            {/* Search Bar - Floating */}
            <div className="absolute top-4 left-16 right-4 z-10">
                <div className="relative">
                    <div className="relative flex items-center bg-white rounded-full shadow-lg border border-gray-200">
                        <Search className="w-5 h-5 text-gray-400 absolute left-4" />
                        <Input
                            type="text"
                            placeholder="Buscar dirección..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 pr-10 h-10 border-0 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setShowSearchResults(false);
                                }}
                                className="absolute right-3 p-1 hover:bg-gray-100 rounded-full transition"
                            >
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        )}
                        {isSearching && (
                            <div className="absolute right-3">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchResults.length > 0 && (
                        <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-72 overflow-y-auto">
                            {searchResults.map((result, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectSearchResult(result)}
                                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition text-left border-b last:border-b-0"
                                >
                                    <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">
                                            {result.placeName}
                                        </p>
                                        <p className="text-sm text-gray-500 truncate">
                                            {result.address}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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
