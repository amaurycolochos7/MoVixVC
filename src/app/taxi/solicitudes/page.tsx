import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function TaxiSolicitudesPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold">Solicitudes Cercanas</h1>

            <div className="space-y-4">
                <Card className="border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base">Centro → Norte</CardTitle>
                            <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">Taxi</span>
                        </div>
                        <p className="text-xs text-text-secondary flex items-center mt-1">
                            <Clock className="w-3 h-3 mr-1" /> Expira en 2:30
                        </p>
                    </CardHeader>
                    <CardContent className="pb-3 text-sm">
                        <p>Oferta: <span className="font-bold text-lg">$50.00</span></p>
                        <p className="text-text-secondary">A 1.2 km de ti</p>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full">Ver Detalles</Button>
                    </CardFooter>
                </Card>

                {/* Empty state example */}
                {/* <div className="text-center py-10 text-text-muted">No hay solicitudes cerca</div> */}
            </div>

            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Componentes Requeridos:</strong>
                <ul className="list-disc ml-4 mt-1">
                    <li>RequestCard</li>
                    <li>ExpirationTimer</li>
                    <li>OfferInput</li>
                </ul>
            </div>
        </div>
    );
}
