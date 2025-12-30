import { Button } from "@/components/ui/button";

export default function TaxiServicioPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Servicio Actual</h1>
            <div className="p-10 text-center bg-surface border border-border rounded-xl">
                <p className="text-text-muted">No tienes un servicio activo.</p>
                <p className="text-xs text-text-secondary mt-2">Ve a la pestaña Disponibles o Solicitudes para tomar uno.</p>
            </div>
        </div>
    );
}
