import { Card, CardContent } from "@/components/ui/card";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-alt">
            <Card className="max-w-md w-full">
                <CardContent className="flex flex-col items-center justify-center py-10">
                    <WifiOff className="h-16 w-16 text-text-muted mb-4" />
                    <h1 className="text-xl font-bold text-text-primary mb-2">Sin Conexión</h1>
                    <p className="text-text-secondary text-center">
                        Parece que no tienes internet. Revisa tu conexión para continuar usando MoVix.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
