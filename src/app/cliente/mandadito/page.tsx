import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function MandaditoWizardPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Nuevo Mandadito</h1>

            <div className="space-y-4">
                <Card className="p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Parada 1 (Recolección)</h3>
                    <Input placeholder="Dirección..." />
                    <Input placeholder="Instrucciones (opcional)" className="text-sm" />
                </Card>

                <Button variant="outline" className="w-full border-dashed">
                    <Plus className="mr-2 h-4 w-4" /> Agregar Parada
                </Button>

                <Card className="p-4 space-y-3 border-primary/20">
                    <h3 className="font-semibold text-sm">Entrega Final</h3>
                    <Input placeholder="Dirección de entrega..." />
                </Card>

                <Button className="w-full">Continuar</Button>
            </div>

            {/* Components Tracking */}
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Componentes Requeridos:</strong>
                <ul className="list-disc ml-4 mt-1">
                    <li>StopInputList</li>
                    <li>AddressAutocomplete</li>
                </ul>
            </div>
        </div>
    );
}
