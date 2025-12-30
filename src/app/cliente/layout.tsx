import type { Metadata } from "next";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { Home, Clock, History, User } from "lucide-react";

export const metadata: Metadata = {
    title: "MoVix - Cliente",
};

export const dynamic = 'force-dynamic';

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
        <>
            <main className="min-h-screen pb-20 pt-4 px-4 bg-surface-alt">
                <div className="mx-auto max-w-md">
                    {children}
                </div>
            </main>
            <BottomNav items={navItems} />
        </>
    );
}
