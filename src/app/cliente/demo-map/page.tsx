"use client";

import { useState, useEffect } from "react";
import { TrackingMap } from "@/components/maps/tracking-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, RotateCcw } from "lucide-react";

// Demo coordinates (CDMX - Zócalo to Reforma)
const ORIGIN = { lat: 19.4326, lng: -99.1332 };
const DESTINATION = { lat: 19.4284, lng: -99.1558 };

// Simulated driver path (will animate from far -> origin)
const DRIVER_PATH = [
    { lat: 19.4400, lng: -99.1400 },
    { lat: 19.4380, lng: -99.1380 },
    { lat: 19.4360, lng: -99.1360 },
    { lat: 19.4350, lng: -99.1350 },
    { lat: 19.4340, lng: -99.1345 },
    { lat: 19.4330, lng: -99.1338 },
    { lat: 19.4326, lng: -99.1332 }, // Arrives at origin
];

type TripStatus = "searching" | "driver_on_way" | "arrived" | "in_trip" | "completed";

export default function DemoMapPage() {
    const [status, setStatus] = useState<TripStatus>("searching");
    const [driverIndex, setDriverIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const driverLocation = DRIVER_PATH[driverIndex];

    // Animation loop
    useEffect(() => {
        if (!isAnimating) return;

        const interval = setInterval(() => {
            setDriverIndex((prev) => {
                if (prev >= DRIVER_PATH.length - 1) {
                    setStatus("arrived");
                    setIsAnimating(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 1500);

        return () => clearInterval(interval);
    }, [isAnimating]);

    const startSimulation = () => {
        setDriverIndex(0);
        setStatus("driver_on_way");
        setIsAnimating(true);
    };

    const resetSimulation = () => {
        setDriverIndex(0);
        setStatus("searching");
        setIsAnimating(false);
    };

    const startTrip = () => {
        setStatus("in_trip");
    };

    return (
        <div className="p-4 space-y-4 pb-24">
            <h1 className="text-2xl font-bold">Demo: Tracking Map</h1>
            <p className="text-sm text-muted-foreground">
                Prueba del mapa Mapbox con seguimiento en tiempo real
            </p>

            {/* Map */}
            <div className="relative">
                <TrackingMap
                    origin={ORIGIN}
                    destination={DESTINATION}
                    driverLocation={driverLocation}
                    status={status}
                    className="w-full h-80 rounded-xl overflow-hidden shadow-lg"
                />
            </div>

            {/* Controls */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Controles de Simulación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Estado:</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${status === "searching" ? "bg-gray-200 text-gray-700" :
                                status === "driver_on_way" ? "bg-yellow-200 text-yellow-800" :
                                    status === "arrived" ? "bg-green-200 text-green-800" :
                                        status === "in_trip" ? "bg-blue-200 text-blue-800" :
                                            "bg-purple-200 text-purple-800"
                            }`}>
                            {status.replace(/_/g, " ").toUpperCase()}
                        </span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {status === "searching" && (
                            <Button onClick={startSimulation} className="gap-2">
                                <Play className="w-4 h-4" />
                                Simular conductor en camino
                            </Button>
                        )}

                        {status === "driver_on_way" && (
                            <Button
                                variant="outline"
                                onClick={() => setIsAnimating(!isAnimating)}
                                className="gap-2"
                            >
                                {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                {isAnimating ? "Pausar" : "Continuar"}
                            </Button>
                        )}

                        {status === "arrived" && (
                            <Button onClick={startTrip} className="gap-2 bg-green-600 hover:bg-green-700">
                                <Play className="w-4 h-4" />
                                Iniciar viaje
                            </Button>
                        )}

                        {status === "in_trip" && (
                            <Button
                                onClick={() => setStatus("completed")}
                                className="gap-2 bg-purple-600 hover:bg-purple-700"
                            >
                                Completar viaje
                            </Button>
                        )}

                        <Button variant="outline" onClick={resetSimulation} className="gap-2">
                            <RotateCcw className="w-4 h-4" />
                            Reiniciar
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Posición del conductor: {driverIndex + 1} / {DRIVER_PATH.length}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
