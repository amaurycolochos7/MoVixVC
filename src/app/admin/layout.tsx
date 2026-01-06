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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-col">
            <AdminHeader />
            <main className="flex-1 pb-24 pt-8 px-4 md:px-6">
                <div className="mx-auto max-w-7xl">
                    {children}
                </div>
            </main>
            <AdminBottomNav />
        </div>
    );
}
