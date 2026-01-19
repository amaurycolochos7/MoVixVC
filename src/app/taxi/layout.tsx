"use client";

import { TaxiBottomNav } from "@/components/navigation/taxi-bottom-nav";
import { RoleGuard } from "@/components/auth/role-guard";
import "mapbox-gl/dist/mapbox-gl.css";

export default function TaxiLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <RoleGuard allowedRoles={["taxi"]}>
            <main className="min-h-screen pb-20">
                {children}
            </main>
            <TaxiBottomNav />
        </RoleGuard>
    );
}


