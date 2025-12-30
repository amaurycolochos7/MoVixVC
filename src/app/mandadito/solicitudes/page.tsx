import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Clock, Package } from "lucide-react";

export default function MandaditoSolicitudesPage() {
    return (
        <div className="space-y-4">
            <h1 className="text-xl font-bold">Mandaditos Disponibles</h1>

            <Card className="border-l-4 border-l-secondary">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-base">Entrega de Paquete</CardTitle>
                        <span className="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full font-medium">Mandadito</span>
                    </div>
                    <p className="text-xs text-text-secondary flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" /> Expira en 4:12
                    </p>
                </CardHeader>
                <CardContent className="pb-3 text-sm">
                    <p className="mb-1"><Package className="inline h-4 w-4 mr-1" /> 3 paradas</p>
                    <p>Oferta: <span className="font-bold text-lg">$80.00</span></p>
                </CardContent>
                <CardFooter>
                    <Button className="w-full bg-secondary hover:bg-secondary/90 text-white">Ver Detalles</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
