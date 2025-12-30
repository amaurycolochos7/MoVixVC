import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { User, Settings, LogOut } from "lucide-react";

export default function ClientePerfilPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Mi Perfil</h1>

            <div className="flex items-center gap-4 py-4">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h2 className="font-semibold">Usuario Cliente</h2>
                    <p className="text-sm text-text-secondary">cliente@example.com</p>
                </div>
            </div>

            <div className="space-y-3">
                <Card>
                    <CardContent className="p-0">
                        <Button variant="ghost" className="w-full justify-start rounded-none h-14 px-6 border-b border-border">
                            <Settings className="mr-3 h-5 w-5" /> Configuración
                        </Button>
                        <Button variant="ghost" className="w-full justify-start rounded-none h-14 px-6 text-danger hover:text-danger hover:bg-danger/10">
                            <LogOut className="mr-3 h-5 w-5" /> Cerrar Sesión
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
