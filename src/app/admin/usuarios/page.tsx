import { Card, CardContent } from "@/components/ui/card";

export default function AdminUsuariosPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
            <Card>
                <CardContent className="p-6 text-text-muted">
                    Lista de usuarios (Tabla placeholder)
                </CardContent>
            </Card>
        </div>
    )
}
