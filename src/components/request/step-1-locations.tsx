"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestWizard } from "@/hooks/useRequestWizard";
import { AddressSelector, AddressData } from "./address-selector";

interface Step1Props {
    wizard: ReturnType<typeof useRequestWizard>;
}

export function Step1Locations({ wizard }: Step1Props) {
    const { nextStep, setOrigin, setDestination, state } = wizard;
    const { serviceType } = state;

    const [originData, setOriginData] = useState<AddressData | null>(null);
    const [destData, setDestData] = useState<AddressData | null>(null);

    const handleNext = () => {
        if (!originData) return;
        if (serviceType === 'taxi' && !destData) return;

        // Force typed cast for now as hook expects lat/lng
        setOrigin({
            address: `${originData.full_address}${originData.neighborhood ? `, ${originData.neighborhood}` : ''}`,
            lat: 0,
            lng: 0,
            // We'll append extra data to the object even if TS complains slightly or if we cast as any
            // Ideally we update the hook types, but for MVP speed this works as JS is flexible at runtime.
            // We will stash "references" in the notes or a separate field later in Step 2 if needed, 
            // but the request object in DB now has columns for them.
            // We need to pass this rich data up.
            ...originData
        } as any);

        if (serviceType === 'taxi' && destData) {
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
