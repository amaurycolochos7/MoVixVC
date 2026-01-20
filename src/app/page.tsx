"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Clock, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header naranja */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 pt-10 pb-24 px-6 rounded-b-[40px] shrink-0">
        <div className="max-w-sm mx-auto text-center">
          <h1 className="text-3xl font-bold text-white mb-1">MoVix</h1>
          <p className="text-orange-100 text-sm">Tu App de Movilidad Local</p>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 px-6 -mt-16 flex flex-col">
        <div className="max-w-sm mx-auto w-full flex flex-col flex-1">
          {/* Card con vehículos */}
          <div className="bg-white rounded-3xl shadow-xl p-5 mb-5 shrink-0">
            <div className="relative h-36 flex items-center justify-center overflow-hidden">
              {/* 1. Moto Delivery - Entra primero (0s - 4s) */}
              <div className="absolute opacity-0 animate-[vehicleOne_12s_ease-in-out_infinite]">
                <Image src="/delivery-moto.png" alt="Moto Delivery" width={128} height={128} className="object-contain" priority />
              </div>

              {/* 2. Moto Ride - Entra segundo (4s - 8s) */}
              <div className="absolute opacity-0 animate-[vehicleTwo_12s_ease-in-out_infinite]">
                <Image src="/moto-ride.png" alt="Moto Ride" width={176} height={176} className="object-contain" />
              </div>

              {/* 3. Taxi - Entra tercero (8s - 12s) */}
              <div className="absolute opacity-0 animate-[vehicleThree_12s_ease-in-out_infinite]">
                <Image src="/taxi.png" alt="Taxi" width={160} height={160} className="object-contain" />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="space-y-3 mb-6 shrink-0">
            <Link href="/login" className="block">
              <Button className="w-full h-12 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200">
                Iniciar sesión
              </Button>
            </Link>
            <Link href="/registro" className="block">
              <Button variant="outline" className="w-full h-12 text-sm font-semibold border-2 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl">
                Crear cuenta
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="flex items-center justify-center gap-8 shrink-0">
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium">24/7</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium">Seguro</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium">Rápido</span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          <div className="text-center pb-4">
            <Link href="/login?role=admin" className="text-xs text-gray-400">v1.0</Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* Vehículo 1: Moto Delivery (0% - 33%) */
        @keyframes vehicleOne {
          0% { transform: translateX(-120px); opacity: 0; }
          5% { transform: translateX(0); opacity: 1; }
          25% { transform: translateX(0); opacity: 1; }
          30% { transform: translateX(120px); opacity: 0; }
          100% { transform: translateX(120px); opacity: 0; }
        }
        
        /* Vehículo 2: Moto Ride (33% - 66%) */
        @keyframes vehicleTwo {
          0% { transform: translateX(-120px); opacity: 0; }
          33% { transform: translateX(-120px); opacity: 0; }
          38% { transform: translateX(0); opacity: 1; }
          58% { transform: translateX(0); opacity: 1; }
          63% { transform: translateX(120px); opacity: 0; }
          100% { transform: translateX(120px); opacity: 0; }
        }
        
        /* Vehículo 3: Taxi (66% - 100%) */
        @keyframes vehicleThree {
          0% { transform: translateX(-120px); opacity: 0; }
          66% { transform: translateX(-120px); opacity: 0; }
          71% { transform: translateX(0); opacity: 1; }
          91% { transform: translateX(0); opacity: 1; }
          96% { transform: translateX(120px); opacity: 0; }
          100% { transform: translateX(120px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
