"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-surface flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-primary">MoVix</h1>
          <p className="text-text-secondary">Tu app de movilidad local</p>
        </div>

        {/* Auth Actions */}
        <div className="space-y-4">
          <Link href="/login" className="block">
            <Button size="lg" className="w-full text-lg h-12 shadow-lg">
              Iniciar Sesión
            </Button>
          </Link>

          <Link href="/registro" className="block">
            <Button variant="outline" size="lg" className="w-full text-lg h-12 border-primary/20 hover:bg-primary/5">
              Registrarse
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center space-y-2 w-full">
        <p className="text-sm font-medium text-text-primary/60">
          Dev Amaury Gordillo
        </p>
        <p className="text-[10px] text-text-secondary/40 font-mono">
          v0.1.1
        </p>
      </div>
    </div>
  );
}
