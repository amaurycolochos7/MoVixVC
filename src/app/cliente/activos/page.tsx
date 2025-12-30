import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function ClienteActivosPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Servicios Activos</h1>
            <Card className="p-8 text-center text-text-muted border-dashed">
                <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">Sin servicios activos</p>
                <p className="text-sm mt-1">Tus servicios en curso aparecerán aquí.</p>
                <Button variant="link" className="mt-2">Ver historial</Button>
            </Card>
        </div>
    );
}

