"use client";

import { useRequestWizard } from "@/hooks/useRequestWizard";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, User, Inbox } from "lucide-react";
import { toast } from "sonner";
import { parseSupabaseError } from "@/lib/error-utils";

interface Step3Props {
    wizard: ReturnType<typeof useRequestWizard>;
    requestId: string; // We need the ID of the created request
}

interface Offer {
    id: string;
    driver_id: string;
    offered_price: number;
    driver?: {
        full_name: string;
    };
}

function OfferCardSkeleton() {
    return (
        <Card className="bg-slate-800 border-slate-700 p-4 flex justify-between items-center">
            <div className="space-y-2">
                <Skeleton className="h-6 w-16 bg-slate-700" />
                <Skeleton className="h-4 w-24 bg-slate-700" />
            </div>
            <Skeleton className="h-9 w-20 bg-slate-700" />
        </Card>
    );
}

export function Step3Waiting({ wizard, requestId }: Step3Props) {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [serverRemainingSeconds, setServerRemainingSeconds] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const mountTimeRef = useRef<number>(Date.now());

    const supabase = createClient();

    // Fetch Request with server-calculated remaining seconds
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // First get server time
                const { data: serverTime } = await supabase.rpc('get_server_time');

                // Then get request data
                const { data: requestData, error } = await supabase
                    .from("service_requests")
                    .select("request_expires_at, created_at")
                    .eq("id", requestId)
                    .single();

                if (requestData && serverTime) {
                    // Calculate remaining using server time
                    const serverNow = new Date(serverTime).getTime();
                    const expiresAt = new Date(requestData.request_expires_at).getTime();
                    const remaining = Math.max(0, Math.ceil((expiresAt - serverNow) / 1000));
                    setServerRemainingSeconds(remaining);
                    mountTimeRef.current = Date.now();
                    console.log(`⏱️ [CLIENT] Server remaining_seconds: ${remaining}`);
                } else if (requestData) {
                    // Fallback if get_server_time RPC not available
                    const expiresAt = new Date(requestData.request_expires_at).getTime();
                    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
                    setServerRemainingSeconds(remaining);
                    mountTimeRef.current = Date.now();
                    console.log(`⏱️ [CLIENT] Fallback remaining: ${remaining}s`);
                }

                // Fetch existing offers
                const { data: offersData, error: offersError } = await supabase
                    .from("offers")
                    .select("*")
                    .eq("request_id", requestId)
                    .eq("status", "pending");

                if (error) throw error;
                if (offersData) setOffers(offersData);
            } catch (err) {
                const { message } = parseSupabaseError(err);
                toast.error(message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [requestId, supabase]);

    // Timer Logic - uses server remaining_seconds, then decrements locally
    useEffect(() => {
        if (serverRemainingSeconds === null) return;

        const getRemaining = () => {
            const elapsedSinceMount = (Date.now() - mountTimeRef.current) / 1000;
            return Math.max(0, Math.round(serverRemainingSeconds - elapsedSinceMount));
        };

        const updateDisplay = (remaining: number) => {
            if (remaining <= 0) {
                setTimeLeft("Expirado");
            } else if (remaining >= 60) {
                const minutes = Math.floor(remaining / 60);
                const seconds = remaining % 60;
                setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
            } else {
                setTimeLeft(`${remaining}s`);
            }
        };

        // Set initial value
        updateDisplay(getRemaining());

        const interval = setInterval(() => {
            const remaining = getRemaining();
            updateDisplay(remaining);
            if (remaining <= 0) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [serverRemainingSeconds]);


    useEffect(() => {
        // Subscribe to offers for this request
        const channel = supabase
            .channel(`client-offers:${requestId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "offers",
                    filter: `request_id=eq.${requestId}`,
                },
                (payload) => {
                    const newOffer = payload.new as Offer;
                    setOffers((prev) => [...prev, newOffer]);
                    toast.info("Nueva oferta recibida");
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [requestId, supabase]);

    const acceptOffer = async (offerId: string, driverId: string) => {
        setIsAccepting(true);
        try {
            const { data, error } = await supabase.rpc("assign_driver_to_request", {
                p_request_id: requestId,
                p_driver_id: driverId,
                p_offer_id: offerId,
                p_expected_version: 1
            });

            if (error) throw error;

            if (data.success) {
                toast.success("Servicio asignado");
                window.location.reload();
            } else {
                toast.error(data.message || "Error desconocido");
            }

        } catch (err) {
            const { message } = parseSupabaseError(err);
            toast.error(message);
        } finally {
            setIsAccepting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-white p-6 items-center">
            <div className="mt-12 mb-8 relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                <div className="bg-slate-800 p-4 rounded-full relative z-10 border-2 border-blue-500">
                    <Loader2 className="h-12 w-12 text-blue-400 animate-spin" />
                </div>
            </div>

            <h2 className="text-xl font-bold mb-2">Buscando conductores...</h2>
            <p className="text-slate-400 text-center text-sm mb-8">
                Estamos notificando a los conductores cercanos.
                <br />
                {timeLeft === "Expirado" ? (
                    <span className="text-red-500 font-bold">Solicitud Expirada</span>
                ) : (
                    <span>Expira en: <span className="font-mono text-white">{timeLeft}</span></span>
                )}
            </p>

            <div className="w-full max-w-md space-y-3 flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="space-y-3">
                        <OfferCardSkeleton />
                        <OfferCardSkeleton />
                    </div>
                ) : offers.length === 0 ? (
                    <div className="text-center text-slate-500 mt-10">
                        <Inbox className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                        <p className="font-medium">No has recibido ofertas</p>
                        <p className="text-xs mt-1">Las ofertas de conductores aparecerán aquí.</p>
                    </div>
                ) : (
                    offers.map((offer) => (
                        <Card key={offer.id} className="bg-slate-800 border-slate-700 p-4 flex justify-between items-center">
                            <div>
                                <div className="text-lg font-bold text-green-400">
                                    ${offer.offered_price}
                                </div>
                                <div className="text-sm text-slate-300 flex items-center gap-1">
                                    <User className="h-3 w-3" /> Conductor
                                </div>
                            </div>
                            <Button
                                onClick={() => acceptOffer(offer.id, offer.driver_id)}
                                disabled={isAccepting || timeLeft === "Expirado"}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Aceptar
                            </Button>
                        </Card>
                    ))
                )}
            </div>

            <Button
                variant="danger"
                className="w-full mt-4"
                disabled={timeLeft === "Expirado"}
            >
                Cancelar Solicitud
            </Button>
        </div>
    );
}
