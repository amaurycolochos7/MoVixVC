import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { parseSupabaseError } from "@/lib/error-utils";

export type ServiceType = "taxi" | "mandadito";

export interface LocationData {
    address: string;
    lat: number;
    lng: number;
    neighborhood?: string;
    address_references?: string;
    contact_phone?: string;
}

export interface RequestState {
    serviceType: ServiceType;
    origin: LocationData;
    destination?: LocationData;
    stops: LocationData[];
    notes: string;
    offerPrice: string;
}

export const useRequestWizard = () => {
    const [step, setStep] = useState(1);
    const [state, setState] = useState<RequestState>({
        serviceType: "taxi", // Default
        origin: { address: "", lat: 0, lng: 0 },
        stops: [],
        notes: "",
        offerPrice: "50",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    const updateState = (updates: Partial<RequestState>) => {
        setState((prev) => ({ ...prev, ...updates }));
    };

    // New Helpers exposed
    const setOrigin = (loc: any) => updateState({ origin: loc });
    const setDestination = (loc: any) => updateState({ destination: loc });
    // setStops...

    const nextStep = () => setStep((p) => p + 1);
    const prevStep = () => setStep((p) => Math.max(1, p - 1));

    const [requestId, setRequestId] = useState<string | null>(null);

    const submitRequest = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            const { data, error: insertError } = await supabase
                .from("service_requests")
                .insert({
                    client_id: user.id,
                    service_type: state.serviceType,
                    status: "pending",

                    origin_address: state.origin.address,
                    origin_neighborhood: state.origin.neighborhood,
                    origin_references: state.origin.address_references,
                    contact_phone: state.origin.contact_phone,
                    origin_lat: 0, origin_lng: 0,

                    destination_address: state.destination?.address,
                    destination_neighborhood: state.destination?.neighborhood,
                    destination_references: state.destination?.address_references,
                    destination_lat: 0, destination_lng: 0,

                    notes: state.notes,
                    estimated_price: parseFloat(state.offerPrice || "0"),
                    request_expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
                })
                .select()
                .single();

            if (insertError) throw insertError;

            setRequestId(data.id);
            setStep(3);
            toast.success("Solicitud creada");
            return data;

        } catch (err: any) {
            const { message } = parseSupabaseError(err);
            setError(message);
            toast.error(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        step,
        state,
        requestId,
        updateState,
        nextStep,
        prevStep,
        submitRequest,
        isLoading,
        error,
        setOrigin, // Exported
        setDestination // Exported
    };
};
