import type { Metadata } from "next";
import { AdminBottomNav } from "@/components/navigation/admin-bottom-nav";

export const metadata: Metadata = {
    title: "MoVix - Admin",
};

import { AdminHeader } from "@/components/admin/admin-header";

export default function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="min-h-screen bg-surface-alt flex flex-col">
            <AdminHeader />
            <main className="flex-1 pb-24 pt-6 px-4">
                <div className="mx-auto max-w-7xl">
                    {/* Wider max-width for admin tables */}
                    {children}
                </div>
            </main>
            <AdminBottomNav />
        </div>
    );
}
