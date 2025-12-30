import type { Metadata } from "next";
import { MandaditoBottomNav } from "@/components/navigation/mandadito-bottom-nav";

export const metadata: Metadata = {
    title: "MoVix - Mandadito",
};

export const dynamic = 'force-dynamic';

export default function MandaditoLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <main className="min-h-screen pb-24 pt-4 px-4 bg-surface-alt">
                <div className="mx-auto max-w-md">
                    {children}
                </div>
            </main>
            <MandaditoBottomNav />
        </>
    );
}
