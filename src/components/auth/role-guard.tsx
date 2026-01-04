"use client";

import { useAuth } from "@/contexts/auth-context";
import { ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ShieldX, Loader2 } from "lucide-react";

interface RoleGuardProps {
    children: ReactNode;
    allowedRoles: string[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { user, profile, loading } = useAuth();
    const router = useRouter();

    // Redirect to home if not authenticated (after loading completes)
    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [loading, user, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Still loading or redirecting
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // User exists but profile not loaded yet
    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!allowedRoles.includes(profile.role)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
                <ShieldX className="h-16 w-16 text-danger mb-4" />
                <h1 className="text-2xl font-bold mb-2">No Autorizado</h1>
                <p className="text-muted-foreground mb-6">
                    No tienes permiso para acceder a esta sección.
                </p>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => router.back()}>
                        Volver
                    </Button>
                    <Button onClick={() => router.push("/")}>
                        Ir al Inicio
                    </Button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

