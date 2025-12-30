"use client";

import Link from "next/link";
import { RequestWizard } from "@/components/request/request-wizard";
import { ServiceTracking } from "@/components/tracking/service-tracking";
import { useActiveTrip } from "@/hooks/useActiveTrip";
import { Button } from "@/components/ui/button";
import { Car, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Home() {
  const { activeTrip, loading } = useActiveTrip("client");

  if (loading) return <div className="h-screen flex items-center justify-center">Cargando...</div>;

  if (activeTrip) {
    return (
      <div className="h-screen w-full relative">
        <ServiceTracking requestId={activeTrip.id} userRole="client" initialRequestData={activeTrip} />
        {/* Floating Menu for Dev Access even in tracking */}
        <div className="absolute top-4 left-4 z-50">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="bg-white/90 backdrop-blur shadow-sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <div className="flex flex-col gap-4 mt-8">
                <h2 className="text-lg font-bold">Menú MoVix</h2>
                <Link href="/taxi" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                  <Car className="h-5 w-5" /> Soy Chofer Taxi
                </Link>
                <Link href="/mandadito" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                  <Car className="h-5 w-5" /> Soy Mandadito
                </Link>
                <Link href="/admin" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                  <Car className="h-5 w-5" /> Admin Panel
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Main Wizard Flow */}
      <RequestWizard />

      {/* Floating Menu for Role Switching (Dev/Access) */}
      <div className="absolute top-4 left-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white/90 backdrop-blur shadow-sm">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <div className="flex flex-col gap-4 mt-8">
              <h2 className="text-lg font-bold">Menú MoVix</h2>
              <Link href="/taxi" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                <Car className="h-5 w-5" /> Soy Chofer Taxi
              </Link>
              <Link href="/mandadito" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                <Car className="h-5 w-5" /> Soy Mandadito
              </Link>
              <Link href="/admin" className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded">
                <Car className="h-5 w-5" /> Admin Panel
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
