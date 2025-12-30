import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Package } from "lucide-react";
import Link from "next/link";

export default function ClienteHomePage() {
    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-primary">MoVix</h1>
            </header>

            <section className="grid grid-cols-2 gap-4">
                <Link href="/cliente/taxi">
                    <Card className="hover:border-primary cursor-pointer transition-colors">
                        <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                            <Car className="h-12 w-12 text-primary" />
                            <span className="font-medium">Taxi</span>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/cliente/mandadito">
                    <Card className="hover:border-primary cursor-pointer transition-colors">
                        <CardContent className="flex flex-col items-center justify-center py-6 gap-2">
                            <Package className="h-12 w-12 text-primary" />
                            <span className="font-medium">Mandadito</span>
                        </CardContent>
                    </Card>
                </Link>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-3">Servicios Activos</h2>
                <Card className="bg-surface-alt border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 text-text-muted">
                        <p>No tienes servicios activos</p>
                    </CardContent>
                </Card>
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-3">Historial Reciente</h2>
                <div className="space-y-3">
                    {/* Placeholder items */}
                    <Card>
                        <CardHeader className="py-3">
                            <CardTitle className="text-base flex justify-between">
                                <span>Viaje al Centro</span>
                                <span className="text-text-secondary font-normal">$45.00</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 pb-3">
                            <p className="text-xs text-text-secondary">Ayer, 14:30 • Finalizado</p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Components Tracking for Phase 1 */}
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Componentes Requeridos:</strong>
                <ul className="list-disc ml-4 mt-1">
                    <li>ServiceCard (Active/History)</li>
                    <li>ServiceTypeSelector</li>
                    <li>HomeHeader</li>
                </ul>
            </div>
        </div>
    );
}
