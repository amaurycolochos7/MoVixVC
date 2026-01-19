"use client";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { RoleGuard } from "@/components/auth/role-guard";
import { Home, Clock, History, User } from "lucide-react";

const navItems = [
    { label: "Inicio", href: "/cliente", icon: Home },
    { label: "Activos", href: "/cliente/activos", icon: Clock },
    { label: "Historial", href: "/cliente/historial", icon: History },
    { label: "Perfil", href: "/cliente/perfil", icon: User },
];

export default function ClienteLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <RoleGuard allowedRoles={["cliente"]}>
            <main className="min-h-screen pb-20">
                {children}
            </main>
            <BottomNav items={navItems} />
        </RoleGuard>
    );
}


