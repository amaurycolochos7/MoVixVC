"use client";

import { useRequestWizard } from "@/hooks/useRequestWizard";
import { Step1Locations } from "./step-1-locations";
import { Step2Details } from "./step-2-details";
import { Step3Waiting } from "./step-3-waiting";
import { GoogleMapWrapper } from "@/components/maps/google-map-wrapper";

export function RequestWizard() {
    const wizard = useRequestWizard();
    const { step } = wizard;

    return (
        <GoogleMapWrapper>
            <div className="h-screen bg-surface flex flex-col">
                {step === 1 && <Step1Locations wizard={wizard} />}
                {step === 2 && <Step2Details wizard={wizard} />}
                {step === 3 && wizard.requestId && <Step3Waiting wizard={wizard} requestId={wizard.requestId} />}
            </div>
        </GoogleMapWrapper>
    );
}
