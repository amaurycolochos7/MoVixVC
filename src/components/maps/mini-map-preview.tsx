"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, X } from 'lucide-react';

const Map = dynamic(() => import("react-map-gl").then((mod) => mod.Map), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
});

const Marker = dynamic(() => import("react-map-gl").then((mod) => mod.Marker), {
    ssr: false
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface MiniMapPreviewProps {
    lat: number;
    lng: number;
    title?: string;
    onClose: () => void;
}

export function MiniMapPreview({ lat, lng, title, onClose }: MiniMapPreviewProps) {
    if (!lat || !lng) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm h-[400px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
                    <span className="bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-xs font-bold border border-slate-700 backdrop-blur shadow-lg">
                        {title || "Ubicación"}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="pointer-events-auto bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur transition border border-white/10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <Map
                    initialViewState={{
                        latitude: lat,
                        longitude: lng,
                        zoom: 15
                    }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle="mapbox://styles/mapbox/outdoors-v12"
                    mapboxAccessToken={MAPBOX_TOKEN}
                    attributionControl={false}
                >
                    <Marker latitude={lat} longitude={lng}>
                        <div className="relative flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-white shadow-xl flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                            <div className="w-1 h-3 bg-orange-500" />
                        </div>
                    </Marker>
                </Map>
            </div>
        </div>
    );
}
