import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Car, Settings } from "lucide-react";

export default function TaxiPerfilPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Perfil Conductor</h1>

            <div className="flex items-center gap-4 py-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h2 className="font-semibold">Juan Pérez</h2>
                    <p className="text-sm text-text-secondary">Taxi • Nissan Versa</p>
                </div>
            </div>

            <div className="space-y-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Car className="text-text-secondary" />
                        <div className="flex-1">
                            <p className="font-medium">Datos del Vehículo</p>
                            <p className="text-xs text-text-secondary">Placas: ABC-123</p>
                        </div>
                        <Button variant="ghost" size="sm">Editar</Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-0">
                        <Button variant="ghost" className="w-full justify-start rounded-none h-14 px-6">
                            <Settings className="mr-3 h-5 w-5" /> Ajustes
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
