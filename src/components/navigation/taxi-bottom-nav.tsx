"use client";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { MapPin, List, Navigation, Wallet, User } from "lucide-react";

export function TaxiBottomNav() {
    const navItems = [
        { label: "Disponible", href: "/taxi", icon: MapPin },
        { label: "Solicitudes", href: "/taxi/solicitudes", icon: List },
        { label: "Servicio", href: "/taxi/servicio", icon: Navigation },
        { label: "Cuenta", href: "/taxi/cuenta", icon: Wallet },
        { label: "Perfil", href: "/taxi/perfil", icon: User },
    ];

    return <BottomNav items={navItems} />;
}
