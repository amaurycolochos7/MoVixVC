"use client";

import { useState } from "react";
import { useRequestWizard } from "@/hooks/useRequestWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, DollarSign, MapPin } from "lucide-react";
import { toast } from "sonner";
import { parseSupabaseError } from "@/lib/error-utils";

interface Step2DetailsProps {
    wizard: ReturnType<typeof useRequestWizard>;
}

export function Step2Details({ wizard }: Step2DetailsProps) {
    const { state, nextStep, prevStep } = wizard;
    const [notes, setNotes] = useState("");
    const [price, setPrice] = useState("50");
    const [submitting, setSubmitting] = useState(false);
    const supabase = createClient();

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            const payload: any = {
                client_id: user.id,
                service_type: state.serviceType,
                status: 'pending',

                origin_address: state.origin.address,
                origin_neighborhood: state.origin.neighborhood,
                origin_references: state.origin.address_references,
                contact_phone: state.origin.contact_phone,
                origin_lat: state.origin.lat || 0,
                origin_lng: state.origin.lng || 0,

                destination_address: state.destination?.address,
                destination_neighborhood: state.destination?.neighborhood,
                destination_references: state.destination?.address_references,
                destination_lat: state.destination?.lat || 0,
                destination_lng: state.destination?.lng || 0,

                notes: notes,
                estimated_price: parseFloat(price),
                request_expires_at: new Date(Date.now() + 10 * 60000).toISOString()
            };

            const { data, error } = await supabase
                .from("service_requests")
                .insert(payload)
                .select()
                .single();

            if (error) throw error;

            toast.success("Solicitud creada");
            nextStep();

        } catch (err) {
            const { message } = parseSupabaseError(err);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pt-4 h-full flex flex-col">
            <h2 className="text-2xl font-bold">Detalles del Servicio</h2>

            <div className="flex-1 space-y-6 overflow-y-auto">
                {/* Route Summary */}
                <Card className="p-4 space-y-4 bg-muted/50">
                    <div className="flex gap-3">
                        <div className="mt-1"><MapPin className="h-5 w-5 text-green-600" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold">RECOGER EN</p>
                            <p className="font-medium text-sm">{state.origin.address}</p>
                            {state.origin.address_references && (
                                <p className="text-xs text-muted-foreground mt-1">"{state.origin.address_references}"</p>
                            )}
                        </div>
                    </div>

                    {state.serviceType === 'taxi' && state.destination && (
                        <div className="flex gap-3 pt-2 border-t">
                            <div className="mt-1"><MapPin className="h-5 w-5 text-red-600" /></div>
                            <div>
                                <p className="text-xs text-muted-foreground font-bold">LLEVAR A</p>
                                <p className="font-medium text-sm">{state.destination.address}</p>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Offer Price */}
                <div className="space-y-2">
                    <Label className="text-base">¿Cuánto ofreces?</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                        <Input
                            type="number"
                            value={price}
                            onChange={e => setPrice(e.target.value)}
                            className="pl-10 text-lg font-bold h-12"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">Sugiere un precio justo para tu viaje.</p>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label>Notas Adicionales</Label>
                    <Textarea
                        placeholder="Instrucciones para el conductor..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={prevStep} className="flex-1">
                    Atrás
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                    {submitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando...
                        </>
                    ) : (
                        "Solicitar Conductor"
                    )}
                </Button>
            </div>
        </div>
    );
}
