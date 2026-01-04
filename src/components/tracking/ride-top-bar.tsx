"use client";

import { User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RideTopBarProps {
    driverName: string;
    driverRating?: number;
    carModel?: string;
    plate?: string;
    onCall?: () => void;
    state?: string;
}

export function RideTopBar({
    driverName,
    driverRating = 5.0,
    carModel = "Taxi",
    plate,
    onCall,
    state
}: RideTopBarProps) {
    return (
        <div className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md shadow-sm px-4 py-2 mt-safe-top">
            <div className="flex items-center justify-between">
                {/* Driver Info */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 overflow-hidden">
                            <User className="w-5 h-5 text-gray-400" />
                            {/* If avatar URL exists, we would use img here */}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                            {driverRating.toFixed(1)}★
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight">
                            {driverName}
                        </h3>
                        <p className="text-xs text-gray-500">
                            {carModel} {plate ? `• ${plate}` : ""}
                        </p>
                    </div>
                </div>

                {/* Call Action */}
                <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full w-10 h-10 p-0 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 bg-white shadow-sm"
                    onClick={onCall}
                >
                    <Phone className="w-4 h-4" />
                </Button>
            </div>

            {/* Optional Status Banner below if needed, or keeping it super minimal */}
        </div>
    );
}
