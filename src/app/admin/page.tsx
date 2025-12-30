import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Wallet } from "lucide-react";

export default function AdminDashboardPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Dashboard Admin</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
                        <Users className="h-4 w-4 text-text-muted" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">150</div>
                        <p className="text-xs text-text-secondary">+12% vs mes anterior</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Servicios Hoy</CardTitle>
                        <Car className="h-4 w-4 text-text-muted" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">89</div>
                        <p className="text-xs text-text-secondary">8 en curso</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos (Est.)</CardTitle>
                        <Wallet className="h-4 w-4 text-text-muted" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">$2,340</div>
                        <p className="text-xs text-text-secondary">Comisiones del día</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Pendientes de Verificación</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-text-muted">3 usuarios esperando revisión de documentos.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
