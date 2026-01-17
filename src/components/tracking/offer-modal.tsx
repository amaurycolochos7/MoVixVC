"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, User, Car } from "lucide-react";

interface OfferModalProps {
    offer: any;
    onClose: () => void;
    onAccept: (offer: any) => void;
    onCounter: (offer: any, amount: number) => void;
    onReject: (offer: any) => void;
}

export function OfferModal({ offer, onClose, onAccept, onCounter, onReject }: OfferModalProps) {
    const supabase = createClient();
    const [driver, setDriver] = useState<any>(null);
    const [counterPrice, setCounterPrice] = useState(offer?.offered_price || 0);

    useEffect(() => {
        if (!offer) return;
        setCounterPrice(offer.offered_price);

        // Fetch driver details
        const fetchDriver = async () => {
            const { data } = await supabase
                .from('users')
                .select('full_name, avatar_url, rating_avg, rating_count')
                .eq('id', offer.driver_id)
                .single();

            if (data) setDriver(data);
        };
        fetchDriver();
    }, [offer?.driver_id, offer?.offered_price]);

    if (!offer) return null;

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 rounded-2xl max-w-sm w-[90%] p-6 pt-8 border-none shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl font-bold mb-2">¡Oferta recibida!</DialogTitle>
                </DialogHeader>

                {/* Driver Info */}
                {driver ? (
                    <div className="flex flex-col items-center gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="w-20 h-20 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-sm">
                            <img
                                src={driver.avatar_url || `https://ui-avatars.com/api/?name=${driver.full_name}&background=random`}
                                alt="Driver"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-lg text-slate-900">{driver.full_name}</h3>
                            <div className="flex items-center justify-center gap-1 text-yellow-500 bg-yellow-50 px-2 py-0.5 rounded-full mt-1">
                                <Star className="w-3.5 h-3.5 fill-current" />
                                <span className="text-sm font-bold">{driver.rating_avg?.toFixed(1) || "5.0"}</span>
                                <span className="text-gray-400 text-xs font-normal">({driver.rating_count || 1})</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-24 flex items-center justify-center text-gray-400">
                        Cargando conductor...
                    </div>
                )}

                {/* Price */}
                <div className="text-center mb-8">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Te ofrece el servicio por</p>
                    <div className="flex items-center justify-center gap-1 text-slate-900">
                        <span className="text-5xl font-black">${offer.offered_price}</span>
                        <span className="text-xl font-bold text-gray-400">MXN</span>
                    </div>
                </div>

                {/* Counter Offer Input */}
                <div className="mb-6 space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex justify-between">
                        <span>Tu contraoferta</span>
                        <span className="text-blue-500 cursor-pointer hover:underline" onClick={() => setCounterPrice(offer.offered_price)}>Restablecer</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <Input
                            type="number"
                            value={counterPrice}
                            onChange={(e) => setCounterPrice(Number(e.target.value))}
                            className="text-lg font-bold pl-8 h-12 text-center bg-gray-50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                <DialogFooter className="flex flex-col gap-3 sm:flex-col sm:space-x-0">
                    {counterPrice === offer.offered_price ? (
                        <Button
                            onClick={() => onAccept(offer)}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 h-14 text-lg font-bold shadow-lg shadow-emerald-500/20 rounded-xl"
                        >
                            Aceptar Oferta
                        </Button>
                    ) : (
                        <Button
                            onClick={() => onCounter(offer, counterPrice)}
                            className="w-full bg-blue-600 hover:bg-blue-700 h-14 text-lg font-bold shadow-lg shadow-blue-500/20 rounded-xl"
                        >
                            Enviar Contraoferta
                        </Button>
                    )}

                    <Button
                        onClick={() => onReject(offer)}
                        variant="ghost"
                        className="w-full h-12 text-gray-400 hover:text-red-500 hover:bg-red-50 font-medium rounded-xl"
                    >
                        Rechazar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
