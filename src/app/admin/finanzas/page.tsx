import { Card, CardContent } from "@/components/ui/card";

export default function AdminFinanzasPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Finanzas</h1>
            <Card>
                <CardContent className="p-6 text-text-muted">
                    Resumen financiero (Gráficos placeholder)
                </CardContent>
            </Card>
        </div>
    )
}
