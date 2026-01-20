import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { parseSupabaseError } from "@/lib/error-utils";

export type ServiceType = "taxi" | "mandadito" | "moto_ride";

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

    // Accept data directly to avoid async state issues
    const submitRequest = async (directData?: Partial<RequestState>) => {
        setIsLoading(true);
        setError(null);

        // Use provided data or fall back to current state
        const data = directData ? { ...state, ...directData } : state;

        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            // DEBUG: Log what we're about to insert
            console.log("📍 [useRequestWizard] About to insert:");
            console.log("   origin_lat:", data.origin.lat);
            console.log("   origin_lng:", data.origin.lng);
            console.log("   Full origin data:", data.origin);

            const { data: result, error: insertError } = await supabase
                .from("service_requests")
                .insert({
                    client_id: user.id,
                    service_type: data.serviceType,
                    status: "pending",

                    origin_address: data.origin.address,
                    origin_neighborhood: data.origin.neighborhood,
                    origin_references: data.origin.address_references,
                    contact_phone: data.origin.contact_phone,
                    origin_lat: data.origin.lat || 0,
                    origin_lng: data.origin.lng || 0,

                    destination_address: data.destination?.address,
                    destination_neighborhood: data.destination?.neighborhood,
                    destination_references: data.destination?.address_references,
                    destination_lat: data.destination?.lat || 0,
                    destination_lng: data.destination?.lng || 0,

                    notes: data.notes,
                    // Base fares: Taxi $33, Mandadito $22
                    estimated_price: data.offerPrice
                        ? parseFloat(data.offerPrice)
                        : (data.serviceType === "taxi" ? 33 : 22),
                    request_expires_at: new Date(Date.now() + 40 * 1000).toISOString(), // 40 seconds
                })
                .select()
                .single();

            console.log("📍 [useRequestWizard] Insert result:", result);

            if (insertError) throw insertError;

            setRequestId(result.id);
            setStep(3);
            toast.success("Solicitud creada");
            return result;

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
