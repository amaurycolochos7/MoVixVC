"use client";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { LayoutDashboard, Users, Car, Wallet } from "lucide-react";

export function AdminBottomNav() {
    const navItems = [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { label: "Usuarios", href: "/admin/usuarios", icon: Users },
        { label: "Servicios", href: "/admin/servicios", icon: Car },
        { label: "Finanzas", href: "/admin/finanzas", icon: Wallet },
    ];

    return <BottomNav items={navItems} />;
}
