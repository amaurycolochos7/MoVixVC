"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, X, ShoppingCart, MapPin, AlignLeft } from 'lucide-react';

const Map = dynamic(() => import("react-map-gl").then((mod) => mod.Map), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>
});

const Marker = dynamic(() => import("react-map-gl").then((mod) => mod.Marker), {
    ssr: false
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface StopDetailModalProps {
    stop: any;
    stopIndex: number;
    onClose: () => void;
}

export function StopDetailModal({ stop, stopIndex, onClose }: StopDetailModalProps) {
    if (!stop) return null;

    // Use specific stop coordinates or fallback (fallback shouldn't happen properly)
    // Note: radar query returns 'request_stops', we need to ensure lat/lng are selected if available
    // The query select * so it should be there.
    const hasLocation = stop.lat && stop.lng;
    const lat = stop.lat;
    const lng = stop.lng;

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-900 sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col h-[85vh] sm:h-[600px] relative">

                {/* Header with Map (Conditioned) */}
                {hasLocation ? (
                    <div className="relative h-[40%] min-h-[200px] w-full bg-slate-800">
                        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
                            <span className="bg-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur">
                                Parada #{stopIndex + 1}
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
                            mapStyle="mapbox://styles/mapbox/dark-v11"
                            mapboxAccessToken={MAPBOX_TOKEN}
                            attributionControl={false}
                        >
                            <Marker latitude={lat} longitude={lng}>
                                <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold animate-bounce">
                                    {stopIndex + 1}
                                </div>
                            </Marker>
                        </Map>
                    </div>
                ) : (
                    /* Simple Header (No Map) */
                    <div className="relative h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
                        <span className="bg-orange-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                            Parada #{stopIndex + 1}
                        </span>
                        <button
                            onClick={onClose}
                            className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-950 relative">
                    {/* Shadow overlay for map transition */}
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />

                    {/* Place Info */}
                    <div>
                        <h3 className="text-white text-xl font-bold leading-tight mb-1">
                            {stop.address || "Ubicación sin nombre"}
                        </h3>
                        <p className="text-slate-400 text-sm flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-orange-500" />
                            <span>Coordenadas: {typeof lat === 'number' ? lat.toFixed(4) : '?'} , {typeof lng === 'number' ? lng.toFixed(4) : '?'}</span>
                        </p>
                    </div>

                    {/* Instructions */}
                    {stop.instructions && (
                        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <AlignLeft className="w-3 h-3" /> Instrucciones
                            </p>
                            <p className="text-slate-200 text-sm">{stop.instructions}</p>
                        </div>
                    )}

                    {/* Shopping List */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-orange-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <ShoppingCart className="w-3.5 h-3.5" /> Lista de compras
                            </p>
                            <span className="text-slate-500 text-xs">
                                {stop.stop_items?.length || 0} productos
                            </span>
                        </div>

                        {stop.stop_items?.length > 0 ? (
                            <div className="space-y-2">
                                {stop.stop_items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                                        <div className="w-6 h-6 rounded bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium text-sm">{item.item_name}</p>
                                            {item.notes && <p className="text-slate-500 text-xs mt-0.5">{item.notes}</p>}
                                        </div>
                                        <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-1 rounded-lg">
                                            <span className="text-orange-500 font-bold text-sm">x{item.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-slate-900 rounded-xl border border-dashed border-slate-800">
                                <p className="text-slate-500 text-sm">No hay productos visibles.</p>
                                <p className="text-slate-600 text-xs mt-1">Es posible que necesites permisos de base de datos.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
