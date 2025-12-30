import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { User, Settings } from "lucide-react";

export default function MandaditoPerfilPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Perfil Mandadito</h1>
            <div className="flex items-center gap-4 py-4">
                <div className="h-16 w-16 bg-secondary/10 rounded-full flex items-center justify-center">
                    <User className="h-8 w-8 text-secondary" />
                </div>
                <div>
                    <h2 className="font-semibold">Mandadito 1</h2>
                    <p className="text-sm text-text-secondary">Moto • Placa 123</p>
                </div>
            </div>
        </div>
    );
}
