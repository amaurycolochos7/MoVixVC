import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PackageX } from "lucide-react";
import Link from "next/link";

export default function MandaditoSolicitudesPage() {
    return (
        <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
            <h1 className="text-xl font-bold px-4 pt-4">Mandaditos Disponibles</h1>

            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 opacity-70">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <PackageX className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">No hay solicitudes</h3>
                <p className="text-sm text-slate-500 max-w-xs mt-2">
                    Por el momento no hay mandaditos disponibles en tu zona.
                </p>
                <Link href="/mandadito">
                    <Button variant="outline" className="mt-6">
                        Volver al Radar
                    </Button>
                </Link>
            </div>
        </div>
    );
}
