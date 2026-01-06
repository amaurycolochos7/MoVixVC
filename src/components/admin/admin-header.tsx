"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminHeader() {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg">
                        <LayoutDashboard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                            MoVix Admin
                        </h1>
                        <p className="text-xs text-gray-500">Panel de Administración</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSignOut}
                        className="text-gray-600 hover:text-red-600 hover:bg-red-50 gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Cerrar Sesión</span>
                    </Button>
                </div>
            </div>
        </header>
    );
}
