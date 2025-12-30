import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

export default function TaxiCuentaPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Mi Cuenta</h1>

            <Card className="bg-surface-alt">
                <CardContent className="p-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                        <Wallet className="w-6 h-6 text-secondary" />
                    </div>
                    <p className="text-sm text-text-secondary">Balance Semanal</p>
                    <p className="text-3xl font-bold text-text-primary">$250.00 MXN</p>
                    <div className="mt-4 w-full flex justify-between text-xs text-text-secondary border-t border-border pt-3">
                        <span>Comisión Corte: Dom 23:59</span>
                        <span className="text-secondary font-medium">AL CORRIENTE</span>
                    </div>
                </CardContent>
            </Card>

            <section>
                <h3 className="font-semibold mb-3">Movimientos Recientes</h3>
                <Card>
                    <CardContent className="p-4 text-center text-sm text-text-muted">
                        Historial de pagos vacío
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
