"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Car, Package, Shield, User } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-surface flex flex-col items-center justify-center p-6">
      {/* Logo / Title */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold text-primary mb-2">MoVix</h1>
        <p className="text-text-secondary">Tu app de movilidad local</p>
      </div>

      {/* Role Selection */}
      <div className="w-full max-w-md space-y-4">
        <h2 className="text-xl font-semibold text-center mb-6">¿Cómo deseas usar MoVix?</h2>

        {/* Cliente */}
        <Link href="/login?role=cliente">
          <Card className="p-5 flex items-center gap-4 hover:bg-primary/5 hover:border-primary transition-all cursor-pointer">
            <div className="bg-primary/10 p-3 rounded-full">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Soy Cliente</h3>
              <p className="text-sm text-text-secondary">Solicitar taxi o mandadito</p>
            </div>
          </Card>
        </Link>

        {/* Taxi Driver */}
        <Link href="/login?role=taxi">
          <Card className="p-5 flex items-center gap-4 hover:bg-secondary/5 hover:border-secondary transition-all cursor-pointer mt-4">
            <div className="bg-secondary/10 p-3 rounded-full">
              <Car className="h-7 w-7 text-secondary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Soy Chofer Taxi</h3>
              <p className="text-sm text-text-secondary">Recibir solicitudes de viaje</p>
            </div>
          </Card>
        </Link>

        {/* Mandadito Driver */}
        <Link href="/login?role=mandadito">
          <Card className="p-5 flex items-center gap-4 hover:bg-orange-500/5 hover:border-orange-500 transition-all cursor-pointer mt-4">
            <div className="bg-orange-500/10 p-3 rounded-full">
              <Package className="h-7 w-7 text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Soy Mandadito</h3>
              <p className="text-sm text-text-secondary">Recibir pedidos de entrega</p>
            </div>
          </Card>
        </Link>

        {/* Admin (smaller, bottom) */}
        <Link href="/login?role=admin">
          <Card className="p-3 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer mt-8">
            <Shield className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600">Panel de Administrador</span>
          </Card>
        </Link>
      </div>

      {/* Footer */}
      <p className="text-xs text-text-secondary mt-12">
        MoVix v0.1.0 • Venustiano Carranza, CDMX
      </p>
    </div>
  );
}

