"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestWizard } from "@/hooks/useRequestWizard";
import { AddressSelector, AddressData } from "./address-selector";
import { useGeolocation } from "@/hooks/useGeolocation";

interface Step1Props {
    wizard: ReturnType<typeof useRequestWizard>;
}

export function Step1Locations({ wizard }: Step1Props) {
    const { nextStep, setOrigin, setDestination, state } = wizard;
    const { serviceType } = state;
    const location = useGeolocation(); // Get real GPS location

    const [originData, setOriginData] = useState<AddressData | null>(null);
    const [destData, setDestData] = useState<AddressData | null>(null);

    const handleNext = () => {
        if (!originData) return;
        if (serviceType === 'taxi' && !destData) return;

        // Use real GPS coordinates from device
        const realLat = location.coordinates?.lat || 0;
        const realLng = location.coordinates?.lng || 0;

        // DEBUG: Log GPS coordinates
        console.log("📍 [Step1] GPS Location from hook:", location);
        console.log("📍 [Step1] realLat:", realLat, "realLng:", realLng);
        console.log("📍 [Step1] originData:", originData);

        setOrigin({
            address: `${originData.full_address}${originData.neighborhood ? `, ${originData.neighborhood}` : ''}`,
            lat: realLat,
            lng: realLng,
            ...originData
        } as any);

        if (serviceType === 'taxi' && destData) {
            // For destination, we don't have GPS - it's just text address
            // Keeping 0,0 for destination is fine since we use text address
            setDestination({
                address: `${destData.full_address}${destData.neighborhood ? `, ${destData.neighborhood}` : ''}`,
                lat: 0,
                lng: 0,
                ...destData
            } as any);
        }

        nextStep();
    };


    return (
        <div className="space-y-6 pt-4 h-full flex flex-col">
            <h2 className="text-2xl font-bold">¿A dónde vamos?</h2>

            <div className="space-y-6 flex-1 overflow-y-auto pb-4">
                <AddressSelector
                    label="📍 ¿Dónde te recogen?"
                    value={originData}
                    onChange={setOriginData}
                />

                {serviceType === 'taxi' && (
                    <AddressSelector
                        label="🏁 ¿A dónde vas?"
                        value={destData}
                        onChange={setDestData}
                    />
                )}
            </div>

            <Button
                className="w-full h-12 text-lg mt-8 mb-4 safe-area-bottom"
                onClick={handleNext}
                disabled={!originData || (serviceType === 'taxi' && !destData)}
            >
                Continuar
            </Button>
        </div>
    );
}
