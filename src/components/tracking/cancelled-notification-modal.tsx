"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

interface CancelledNotificationModalProps {
    open: boolean;
    cancelledBy: "client" | "driver";
    reason: string;
    onClose: () => void;
}

export function CancelledNotificationModal({
    open,
    cancelledBy,
    reason,
    onClose
}: CancelledNotificationModalProps) {
    const title = cancelledBy === "client"
        ? "El cliente canceló el servicio"
        : "El mandadito canceló el servicio";

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-white rounded-2xl border-none shadow-2xl">
                <DialogHeader className="text-center">
                    <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <XCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <DialogTitle className="text-xl font-bold text-center text-gray-900">
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                        <p className="text-sm text-gray-500 font-medium mb-1">Motivo:</p>
                        <p className="text-gray-800 font-semibold">{reason || "No especificado"}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={onClose}
                        className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl"
                    >
                        Entendido
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
