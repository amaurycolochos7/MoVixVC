"use client";

import { BottomNav } from "@/components/navigation/bottom-nav";
import { MapPin, List, Navigation, Wallet, User } from "lucide-react";

export function MandaditoBottomNav() {
    const navItems = [
        { label: "Disponible", href: "/mandadito", icon: MapPin },
        { label: "Solicitudes", href: "/mandadito/solicitudes", icon: List },
        { label: "Servicio", href: "/mandadito/servicio", icon: Navigation },
        { label: "Cuenta", href: "/mandadito/cuenta", icon: Wallet },
        { label: "Perfil", href: "/mandadito/perfil", icon: User },
    ];

    return <BottomNav items={navItems} />;
}
