"use client";

import { useState } from "react";
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetTrigger
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Car, Phone, Shield, Share2, MapPin, X, MessageCircle } from "lucide-react";
import CarIcon from "@/assets/map/car-topdown.svg";

interface RideBottomSheetProps {
    eta: number; // minutes
    distance: number; // km
    status: string; // "arriving", "in_trip", "completed" (mapped from step)
    destination: string;
    pickup: string;
    driverName: string;
    driverPlate?: string;
    driverCar?: string;
    price?: number;
    isStatusChanging?: boolean; // NEW: Trigger animation on status change
    onCancel?: () => void;
    onCall?: () => void;
    onMessage?: () => void;
    onShare?: () => void;
}

export function RideBottomSheet({
    eta,
    distance,
    status,
    destination,
    pickup,
    driverName,
    driverPlate = "ABC-123",
    driverCar = "Nissan Versa",
    price,
    isStatusChanging = false,
    onCancel,
    onCall,
    onMessage,
    onShare
}: RideBottomSheetProps) {
    // We can control open state if needed, but default behavior is fine effectively
    // The sheet should be always visible in compact mode? 
    // Actually Radix Dialog/Sheet is usually overlay. 
    // For a persistent bottom sheet like Uber/Didi, we usually need a custom implementation 
    // or use the Sheet with `modal={false}` if supported, or just absolute positioning.
    // The existing `bottom-sheet.tsx` seems to be a wrapper around Radix Dialog.
    // Radix Dialog is modal by default. 
    // Given the requirement "Compact state... Expanded state", a standard modal sheet might not work perfectly 
    // without clicking a trigger. 
    // HOWEVER, for this refactor, I will build a custom animated div structure that MIMICS a bottom sheet
    // and handles the drag/snap logic simply, OR just toggle states with a button/tap.
    // Making a full draggable sheet from scratch is complex.
    // I will use a simple state toggle (Compact <-> Expanded) for now to ensure reliability.

    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    // Mappings
    const getStatusText = () => {
        switch (status) {
            case "accepted": return "Conductor asignado";
            case "on_the_way": return "En camino";
            case "nearby": return "Muy cerca";
            case "arrived": return "Ha llegado";
            case "picked_up": return "En viaje";
            case "in_transit": return "Llegando";
            default: return "Conectando...";
        }
    };

    return (
        <div
            className={`
                fixed bottom-0 left-0 right-0 z-40 
                bg-white/95 backdrop-blur-md shadow-[0_-5px_20px_rgba(0,0,0,0.1)]
                transition-all duration-500 ease-in-out border-t border-gray-100
                ${isExpanded ? 'h-[360px] rounded-t-3xl' : 'h-[160px] rounded-t-2xl'}
            `}
        >
            {/* Drag Handle / Click area to toggle */}
            <div
                className="w-full h-6 flex items-center justify-center cursor-pointer"
                onClick={toggleExpand}
            >
                <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-5 flex flex-col h-full">
                {/* Compact Content (Always visible) */}
                <div className="flex justify-between items-start mb-4" onClick={toggleExpand}>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                                {eta} min
                            </h2>
                            <span className={`px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wide transition-all duration-300 ${isStatusChanging ? 'animate-bounce scale-110' : 'scale-100'
                                }`}>
                                {getStatusText()}
                            </span>
                        </div>
                        <p className="text-gray-500 text-sm font-medium flex items-center gap-1.5 truncate max-w-[200px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                            {destination}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                            {distance.toFixed(1)} km • {driverCar} ({driverPlate})
                        </p>
                    </div>

                    {/* Primary Action Button (Compact) */}
                    {!isExpanded && (
                        <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 shadow-md"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMessage?.();
                            }}
                        >
                            Chat
                        </Button>
                    )}
                </div>

                {/* Expanded Content */}
                <div className={`
                    overflow-y-auto transition-opacity duration-300 flex-1
                    ${isExpanded ? 'opacity-100 visible' : 'opacity-0 invisible h-0'}
                `}>
                    {/* Actions Grid */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-12 h-12 rounded-full border-gray-200 bg-gray-50 text-gray-700"
                                onClick={onCall}
                            >
                                <Phone className="w-5 h-5" />
                            </Button>
                            <span className="text-[10px] text-gray-500 font-medium">Llamar</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-12 h-12 rounded-full border-gray-200 bg-gray-50 text-gray-700"
                                onClick={onMessage}
                            >
                                <MessageCircle className="w-5 h-5" />
                            </Button>
                            <span className="text-[10px] text-gray-500 font-medium">Chat</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-12 h-12 rounded-full border-gray-200 bg-gray-50 text-gray-700"
                                onClick={onShare}
                            >
                                <Share2 className="w-5 h-5" />
                            </Button>
                            <span className="text-[10px] text-gray-500 font-medium">Compartir</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="w-12 h-12 rounded-full border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200"
                                onClick={onCancel}
                            >
                                <X className="w-5 h-5" />
                            </Button>
                            <span className="text-[10px] text-red-500 font-medium">Cancelar</span>
                        </div>
                    </div>

                    {/* Trip Details */}
                    <div className="space-y-4 mb-4">
                        <h3 className="text-sm font-bold text-gray-900">Detalle del viaje</h3>

                        <div className="relative pl-6 space-y-4">
                            {/* Line connector */}
                            <div className="absolute left-2 top-2 bottom-4 w-0.5 bg-gray-200" />

                            <div className="relative">
                                <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-4 border-white bg-green-500 shadow-sm" />
                                <p className="text-xs text-gray-500 mb-0.5">Recogida</p>
                                <p className="text-sm font-medium text-gray-800 leading-tight">{pickup}</p>
                            </div>

                            <div className="relative">
                                <div className="absolute -left-6 top-1 w-4 h-4 rounded-full border-4 border-white bg-red-500 shadow-sm" />
                                <p className="text-xs text-gray-500 mb-0.5">Destino</p>
                                <p className="text-sm font-medium text-gray-800 leading-tight">{destination}</p>
                            </div>
                        </div>
                    </div>

                    {/* Price & Safety */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-2">
                        <div>
                            <p className="text-xs text-gray-500">Tarifa estimada</p>
                            <p className="text-lg font-bold text-gray-900">${price?.toFixed(2) || " --"}</p>
                        </div>

                        <Button variant="ghost" className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 h-auto py-2 px-3">
                            <Shield className="w-4 h-4 mr-2" />
                            Centro de Seguridad
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
