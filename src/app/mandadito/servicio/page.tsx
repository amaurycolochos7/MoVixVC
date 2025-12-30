import { Button } from "@/components/ui/button";

export default function MandaditoServicioPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Servicio Actual</h1>
            <div className="p-10 text-center bg-surface border border-border rounded-xl">
                <p className="text-text-muted">No hay mandadito activo.</p>
            </div>
        </div>
    );
}
