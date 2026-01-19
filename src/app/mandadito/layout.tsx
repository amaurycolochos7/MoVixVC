"use client";

import { MandaditoBottomNav } from "@/components/navigation/mandadito-bottom-nav";

export default function MandaditoLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <main className="min-h-screen pb-20">
                {children}
            </main>
            <MandaditoBottomNav />
        </>
    );
}


