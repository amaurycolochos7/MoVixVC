import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ClienteHistorialPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold">Historial de Viajes</h1>
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <Card key={i}>
                        <CardHeader className="py-3">
                            <CardTitle className="text-base flex justify-between">
                                <span>Viaje #{1000 + i}</span>
                                <span className="text-text-secondary font-normal">$45.00</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 pb-3">
                            <p className="text-xs text-text-secondary">28 Dic 2025 • Finalizado</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
