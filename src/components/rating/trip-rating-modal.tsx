"use client";

import { useState } from "react";
import { Star, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface TripRatingModalProps {
    requestId: string;
    driverId: string;
    driverName: string;
    onClose: () => void;
    onRated?: () => void;
}

export function TripRatingModal({
    requestId,
    driverId,
    driverName,
    onClose,
    onRated,
}: TripRatingModalProps) {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const supabase = createClient();

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error("Por favor selecciona una calificación");
            return;
        }

        setSubmitting(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            const { error } = await supabase.from("driver_ratings").insert({
                request_id: requestId,
                driver_id: driverId,
                client_id: user.id,
                rating,
                comment: comment.trim() || null,
            });

            if (error) throw error;

            toast.success("¡Gracias por tu calificación!");
            onRated?.();
            onClose();
        } catch (err: any) {
            console.error("Error rating driver:", err);
            toast.error("Error al enviar calificación");
        } finally {
            setSubmitting(false);
        }
    };

    const getRatingText = (stars: number) => {
        switch (stars) {
            case 1: return "Muy malo";
            case 2: return "Malo";
            case 3: return "Regular";
            case 4: return "Bueno";
            case 5: return "Excelente";
            default: return "Selecciona una calificación";
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md animate-in zoom-in-95 duration-200">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">¿Cómo estuvo tu viaje?</CardTitle>
                    <p className="text-muted-foreground text-sm">
                        Califica a <span className="font-semibold text-foreground">{driverName}</span>
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Star Rating */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="transition-transform hover:scale-110 active:scale-95"
                                >
                                    <Star
                                        className={`h-10 w-10 transition-colors ${star <= (hoveredRating || rating)
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-gray-300"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        <p className={`text-sm font-medium transition-colors ${rating >= 4 ? "text-green-600" :
                                rating >= 3 ? "text-yellow-600" :
                                    rating >= 1 ? "text-red-600" : "text-muted-foreground"
                            }`}>
                            {getRatingText(hoveredRating || rating)}
                        </p>
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                        <Textarea
                            placeholder="Comentario opcional..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            className="resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Omitir
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleSubmit}
                            disabled={submitting || rating === 0}
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Send className="h-4 w-4 mr-2" />
                            )}
                            Calificar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
