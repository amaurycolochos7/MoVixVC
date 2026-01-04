"use client";

import { MandaditoBottomNav } from "@/components/navigation/mandadito-bottom-nav";

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


