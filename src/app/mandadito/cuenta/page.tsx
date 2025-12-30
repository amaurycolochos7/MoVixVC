import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";

export default function MandaditoCuentaPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Mi Cuenta (Mandadito)</h1>
            <Card className="bg-surface-alt">
                <CardContent className="p-6 flex flex-col items-center">
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                        <Wallet className="w-6 h-6 text-secondary" />
                    </div>
                    <p className="text-sm text-text-secondary">Balance</p>
                    <p className="text-3xl font-bold text-text-primary">$0.00 MXN</p>
                </CardContent>
            </Card>
        </div>
    );
}
