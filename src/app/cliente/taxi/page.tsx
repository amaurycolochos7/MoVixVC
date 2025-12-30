import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function TaxiWizardPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Solicitar Taxi</h1>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">¿A dónde vas?</label>
                    <Input placeholder="Buscar destino..." />
                </div>

                <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                    <span className="text-text-muted">Mapa Placeholder</span>
                </div>

                <Button className="w-full">Confirmar Destino</Button>
            </div>

            {/* Components Tracking */}
            <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Componentes Requeridos:</strong>
                <ul className="list-disc ml-4 mt-1">
                    <li>GoogleMapComponent</li>
                    <li>LocationSearchInput (Autocomplete)</li>
                    <li>WizardStepIndicator</li>
                </ul>
            </div>
        </div>
    );
}
