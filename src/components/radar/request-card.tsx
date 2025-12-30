"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Clock } from "lucide-react";

interface RequestCardProps {
    request: any; // Type properly later
    onOffer: (req: any) => void;
}

export function RequestCard({ request, onOffer }: RequestCardProps) {
    return (
        <Card className="p-4 mb-3 shadow-md border-l-4 border-l-primary cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => onOffer(request)}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <Clock className="h-3 w-3" />
                    <span>Hace unos momentos</span>
                    {/* Could use date-fns formatDistanceToNow(new Date(request.created_at)) */}
                </div>
                <div className="text-xl font-bold text-green-600">
                    ${request.estimated_price}
                </div>
            </div>

            <div className="space-y-3">
                {/* Origin */}
                <div>
                    <div className="flex items-center gap-1 font-bold text-sm text-primary">
                        <MapPin className="h-4 w-4 text-green-600" />
                        <span>RECOGER: {request.origin_neighborhood || 'Ubicación'}</span>
                    </div>
                    <p className="text-sm ml-5 text-gray-700">{request.origin_address}</p>
                    {request.origin_references && (
                        <p className="text-xs ml-5 text-gray-500 italic">Ref: {request.origin_references}</p>
                    )}
                </div>

                {/* Destination */}
                {request.destination_address && (
                    <div>
                        <div className="flex items-center gap-1 font-bold text-sm text-primary">
                            <MapPin className="h-4 w-4 text-red-600" />
                            <span>ENTREGAR: {request.destination_neighborhood || 'Destino'}</span>
                        </div>
                        <p className="text-sm ml-5 text-gray-700">{request.destination_address}</p>
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-between items-center">
                {request.notes && (
                    <div className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded max-w-[70%] truncate">
                        Nota: {request.notes}
                    </div>
                )}
                {!request.notes && <div />} {/* Spacer */}

                <Button size="sm" className="px-6">Ofertar</Button>
            </div>
        </Card>
    );
}
