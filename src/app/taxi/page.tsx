"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Radar } from "@/components/radar/radar";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { Switch } from "@/components/ui/switch";

export default function TaxiHomePage() {
    const [isAvailable, setIsAvailable] = useState(false);
    const { activeTrip } = useActiveTrip("driver");

    if (activeTrip) {
        return (
            <div className="h-[calc(100vh-6rem)] flex flex-col relative">
                <ServiceTracking requestId={activeTrip.id} userRole="driver" initialRequestData={activeTrip} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col relative">
            {/* Top Stat Bar / Availability */}
            <div className="absolute top-2 left-2 right-2 z-10 flex gap-2">
                <Card className="flex-1 p-2 flex items-center justify-between shadow-lg bg-white/90 backdrop-blur">
                    <span className="font-semibold text-sm">Disponible</span>
                    <Switch
                        checked={isAvailable}
                        onCheckedChange={setIsAvailable}
                    />
                </Card>
            </div>

            {/* Radar / Map Area */}
            <div className="flex-1 rounded-xl overflow-hidden relative border-border m-0">
                <Radar serviceType="taxi" isAvailable={isAvailable} />
            </div>

            {/* Stats Footer - Optional, maybe hide when map active? Keeping for now */}
            {!isAvailable && (
                <Card className="m-2">
                    <div className="p-4 flex justify-between items-center bg-surface-alt rounded-t-xl">
                        <div className="text-center">
                            <p className="text-2xl font-bold">5</p>
                            <p className="text-xs text-text-secondary">Viajes</p>
                        </div>
                        <div className="h-8 w-[1px] bg-border"></div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-secondary">$180</p>
                            <p className="text-xs text-text-secondary">Ganancia</p>
                        </div>
                        <div className="h-8 w-[1px] bg-border"></div>
                        <div className="text-center">
                            <p className="text-2xl font-bold">4.9</p>
                            <p className="text-xs text-text-secondary">Calif.</p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
