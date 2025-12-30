"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Radar } from "@/components/radar/radar";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { Switch } from "@/components/ui/switch";

export default function MandaditoHomePage() {
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
            <div className="absolute top-2 left-2 right-2 z-10 flex gap-2">
                <Card className="flex-1 p-2 flex items-center justify-between shadow-lg bg-white/90 backdrop-blur">
                    <span className="font-semibold text-sm">Disponible (Mandadito)</span>
                    <Switch
                        checked={isAvailable}
                        onCheckedChange={setIsAvailable}
                    />
                </Card>
            </div>

            <div className="flex-1 rounded-xl overflow-hidden relative border-border m-0">
                <Radar serviceType="mandadito" isAvailable={isAvailable} />
            </div>
        </div>
    );
}
