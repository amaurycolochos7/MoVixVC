import type { Metadata } from "next";
import { AdminBottomNav } from "@/components/navigation/admin-bottom-nav";

export const metadata: Metadata = {
    title: "MoVix - Admin",
};

export default function AdminLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <main className="min-h-screen pb-24 pt-4 px-4 bg-surface-alt">
                <div className="mx-auto max-w-4xl">
                    {/* Wider max-width for admin tables */}
                    {children}
                </div>
            </main>
            <AdminBottomNav />
        </>
    );
}
