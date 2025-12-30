'use client';

// src/app/(driver)/kyc/page.tsx
// Driver KYC verification page

import { KYCStatus, KYCMiniBanner } from '@/components/kyc';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DriverKYCPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/"
                        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </Link>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Verificación de cuenta
                    </h1>
                </div>
            </header>

            {/* Main content */}
            <main className="max-w-lg mx-auto px-4 py-6">
                <KYCStatus />
            </main>

            {/* Info section */}
            <section className="max-w-lg mx-auto px-4 py-6 mt-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                        ¿Por qué verificamos tu identidad?
                    </h3>
                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>
                            <span>Garantizamos la seguridad de todos nuestros usuarios</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>
                            <span>Cumplimos con regulaciones de transporte y mensajería</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">✓</span>
                            <span>Protegemos tu cuenta contra uso no autorizado</span>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
}
