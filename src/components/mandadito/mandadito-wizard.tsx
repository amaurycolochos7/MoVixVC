"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShoppingBag, Package, MapPin, Plus, Trash2, ChevronDown, ChevronUp, Loader2, Check, Store, Bike, Navigation, CreditCard, Lock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LocationPickerMap } from "@/components/maps/location-picker-map";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coordinates } from "@/lib/mapbox";

interface StopItem {
    id: string;
    name: string;
    quantity: number;
    notes: string;
}

interface Stop {
    id: string;
    address: string;
    lat?: number;
    lng?: number;
    instructions: string;
    items: StopItem[];
    isExpanded: boolean;
}

type MandaditoType = "shopping" | "delivery" | "payment" | "custom";
type WizardStep = "mode" | "stops" | "delivery" | "payment" | "confirm";

interface LocationData {
    coords: Coordinates;
    address: string;
    placeName: string;
}

export function MandaditoWizard() {
    const router = useRouter();
    const supabase = createClient();

    const [step, setStep] = useState<WizardStep>("mode");
    const [mandaditoType, setMandaditoType] = useState<MandaditoType | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [deliveryReferences, setDeliveryReferences] = useState("");
    const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // For delivery type
    const [pickupAddress, setPickupAddress] = useState("");
    const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
    const [pickupInstructions, setPickupInstructions] = useState("");
    const [destinationAddress, setDestinationAddress] = useState("");
    const [destinationCoords, setDestinationCoords] = useState<Coordinates | null>(null);
    const [destinationInstructions, setDestinationInstructions] = useState("");

    // For payment type
    const [paymentType, setPaymentType] = useState<"deposit" | "bill" | "other">("deposit");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentReference, setPaymentReference] = useState("");
    const [paymentInstructions, setPaymentInstructions] = useState("");
    const [paymentLocationName, setPaymentLocationName] = useState("");

    // Map picker state
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [stopToDeleteId, setStopToDeleteId] = useState<string | null>(null);
    const [mapPickerTarget, setMapPickerTarget] = useState<
        "pickup" | "destination" | "delivery" | "paymentLocation" | { stopId: string } | null
    >(null);

    // Open map picker for different targets
    const openMapPicker = (target: "pickup" | "destination" | "delivery" | "paymentLocation" | { stopId: string }) => {
        setMapPickerTarget(target);
        setShowMapPicker(true);
    };

    // Handle map location confirm
    const handleMapConfirm = (location: LocationData) => {
        if (mapPickerTarget === "pickup") {
            setPickupAddress(location.address);
            setPickupCoords(location.coords);
        } else if (mapPickerTarget === "destination") {
            setDestinationAddress(location.address);
            setDestinationCoords(location.coords);
        } else if (mapPickerTarget === "delivery") {
            setDeliveryAddress(location.address);
            setDeliveryCoords(location.coords);
        } else if (mapPickerTarget === "paymentLocation") {
            setDestinationAddress(location.address);
            setDestinationCoords(location.coords);
            if (!paymentLocationName.trim()) {
                setPaymentLocationName(location.placeName);
            }
        } else if (mapPickerTarget && typeof mapPickerTarget === "object" && "stopId" in mapPickerTarget) {
            // Update stop with map location - batch update to ensure all fields are set
            setStops(prevStops => prevStops.map(s => {
                if (s.id === mapPickerTarget.stopId) {
                    return {
                        ...s,
                        // Only update address if user hasn't typed one
                        address: s.address.trim() || location.placeName,
                        lat: location.coords.lat,
                        lng: location.coords.lng
                    };
                }
                return s;
            }));
        }
        setShowMapPicker(false);
        setMapPickerTarget(null);
    };

    const addStop = () => {
        setStops([
            ...stops,
            {
                id: crypto.randomUUID(),
                address: "",
                instructions: "",
                items: [],
                isExpanded: true,
            },
        ]);
    };

    const removeStop = (stopId: string) => {
        setStops(stops.filter((s) => s.id !== stopId));
    };

    const updateStop = (stopId: string, field: keyof Stop, value: any) => {
        setStops(stops.map((s) => (s.id === stopId ? { ...s, [field]: value } : s)));
    };

    const toggleStopExpand = (stopId: string) => {
        setStops(stops.map((s) => (s.id === stopId ? { ...s, isExpanded: !s.isExpanded } : s)));
    };

    const addItem = (stopId: string) => {
        setStops(
            stops.map((s) =>
                s.id === stopId
                    ? {
                        ...s,
                        items: [
                            ...s.items,
                            { id: crypto.randomUUID(), name: "", quantity: 1, notes: "" },
                        ],
                    }
                    : s
            )
        );
    };

    const removeItem = (stopId: string, itemId: string) => {
        setStops(
            stops.map((s) =>
                s.id === stopId
                    ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
                    : s
            )
        );
    };

    const updateItem = (stopId: string, itemId: string, field: keyof StopItem, value: any) => {
        setStops(
            stops.map((s) =>
                s.id === stopId
                    ? {
                        ...s,
                        items: s.items.map((i) =>
                            i.id === itemId ? { ...i, [field]: value } : i
                        ),
                    }
                    : s
            )
        );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No autenticado");

            if (mandaditoType === "shopping") {
                // Validate
                if (stops.length === 0) {
                    toast.error("Agrega al menos una parada");
                    return;
                }
                if (!deliveryAddress.trim()) {
                    toast.error("Ingresa tu dirección de entrega");
                    return;
                }

                // Create request
                const { data: request, error: reqError } = await supabase
                    .from("service_requests")
                    .insert({
                        client_id: user.id,
                        service_type: "mandadito",
                        mandadito_type: "shopping",
                        origin_address: deliveryAddress,
                        origin_lat: deliveryCoords?.lat,
                        origin_lng: deliveryCoords?.lng,
                        delivery_address: deliveryAddress,
                        delivery_lat: deliveryCoords?.lat,
                        delivery_lng: deliveryCoords?.lng,
                        delivery_references: deliveryReferences,
                        notes: `Compras en ${stops.length} parada(s)`,
                        estimated_price: 25, // Driver earnings (total will be 25 + 3 commission = 28)
                        request_expires_at: new Date(Date.now() + 110 * 1000).toISOString(), // 1:50 (110 seconds)
                        municipio: "Venustiano Carranza",
                    })
                    .select()
                    .single();

                if (reqError) throw reqError;

                // Create stops with items
                for (let i = 0; i < stops.length; i++) {
                    const stop = stops[i];

                    const { data: stopData, error: stopError } = await supabase
                        .from("request_stops")
                        .insert({
                            request_id: request.id,
                            stop_order: i + 1,
                            address: stop.address,
                            lat: stop.lat,
                            lng: stop.lng,
                            instructions: stop.instructions,
                            stop_type: "errand",
                        })
                        .select()
                        .single();

                    if (stopError) throw stopError;

                    // Insert items for this stop
                    if (stop.items.length > 0) {
                        const itemsToInsert = stop.items.map((item, idx) => ({
                            stop_id: stopData.id,
                            item_name: item.name,
                            quantity: item.quantity,
                            notes: item.notes,
                            item_order: idx + 1,
                        }));

                        const { error: itemsError } = await supabase
                            .from("stop_items")
                            .insert(itemsToInsert);

                        if (itemsError) throw itemsError;
                    }
                }

                console.log("✅ Mandadito Created:", request.id, "Stops inserted:", stops.length);
                toast.success("¡Mandadito creado!");
                router.push(`/cliente/tracking/${request.id}`);

            } else if (mandaditoType === "delivery") {
                // Validate
                if (!pickupAddress.trim() || !destinationAddress.trim()) {
                    toast.error("Ingresa origen y destino");
                    return;
                }

                // Create request
                const { data: request, error: reqError } = await supabase
                    .from("service_requests")
                    .insert({
                        client_id: user.id,
                        service_type: "mandadito",
                        mandadito_type: "delivery",
                        origin_address: pickupAddress,
                        origin_lat: pickupCoords?.lat,
                        origin_lng: pickupCoords?.lng,
                        destination_address: destinationAddress,
                        destination_lat: destinationCoords?.lat,
                        destination_lng: destinationCoords?.lng,
                        notes: pickupInstructions,
                        estimated_price: 25, // Driver earnings (total will be 25 + 3 commission = 28)
                        request_expires_at: new Date(Date.now() + 110 * 1000).toISOString(), // 1:50 (110 seconds)
                        municipio: "Venustiano Carranza",
                    })
                    .select()
                    .single();

                if (reqError) throw reqError;

                // Create two stops: pickup and delivery
                await supabase.from("request_stops").insert([
                    {
                        request_id: request.id,
                        stop_order: 1,
                        address: pickupAddress,
                        lat: pickupCoords?.lat,
                        lng: pickupCoords?.lng,
                        instructions: pickupInstructions,
                        stop_type: "pickup",
                    },
                    {
                        request_id: request.id,
                        stop_order: 2,
                        address: destinationAddress,
                        lat: destinationCoords?.lat,
                        lng: destinationCoords?.lng,
                        instructions: destinationInstructions,
                        stop_type: "delivery",
                    },
                ]);

                toast.success("¡Envío creado!");
                router.push(`/cliente/tracking/${request.id}`);

            } else if (mandaditoType === "payment") {
                // Validate
                if (!pickupAddress.trim() || !destinationAddress.trim()) {
                    toast.error("Ingresa las ubicaciones");
                    return;
                }
                if (!paymentAmount.trim()) {
                    toast.error("Ingresa el monto a pagar");
                    return;
                }

                // Create notes with payment details
                const paymentTypeLabels = {
                    deposit: "Depósito bancario",
                    bill: "Pago de servicio",
                    other: "Otro pago"
                };
                const paymentNotes = `${paymentTypeLabels[paymentType]} | Monto: $${paymentAmount}${paymentReference ? ` | Ref: ${paymentReference}` : ""}${paymentInstructions ? ` | ${paymentInstructions}` : ""}`;

                // Create request
                const { data: request, error: reqError } = await supabase
                    .from("service_requests")
                    .insert({
                        client_id: user.id,
                        service_type: "mandadito",
                        mandadito_type: "payment",
                        origin_address: pickupAddress,
                        origin_lat: pickupCoords?.lat,
                        origin_lng: pickupCoords?.lng,
                        destination_address: destinationAddress,
                        destination_lat: destinationCoords?.lat,
                        destination_lng: destinationCoords?.lng,
                        notes: paymentNotes,
                        estimated_price: 25, // Driver earnings
                        request_expires_at: new Date(Date.now() + 110 * 1000).toISOString(),
                        municipio: "Venustiano Carranza",
                        // Store payment details in delivery fields for compatibility
                        delivery_address: paymentLocationName || destinationAddress,
                        delivery_lat: destinationCoords?.lat,
                        delivery_lng: destinationCoords?.lng,
                        delivery_references: `Monto: $${paymentAmount} | ${paymentReference ? `Ref: ${paymentReference}` : ""} | ${paymentInstructions || ""}`.trim(),
                    })
                    .select()
                    .single();

                if (reqError) throw reqError;

                toast.success("¡Pago solicitado!");
                router.push(`/cliente/tracking/${request.id}`);
            }
        } catch (err: any) {
            console.error("Error creating mandadito:", err);
            toast.error(err.message || "Error al crear mandadito");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Show Map Picker
    if (showMapPicker) {
        const initialLocation =
            mapPickerTarget === "pickup" ? pickupCoords :
                mapPickerTarget === "destination" ? destinationCoords :
                    mapPickerTarget === "delivery" ? deliveryCoords :
                        mapPickerTarget && typeof mapPickerTarget === "object" && "stopId" in mapPickerTarget
                            ? stops.find(s => s.id === mapPickerTarget.stopId)?.lat
                                ? { lat: stops.find(s => s.id === mapPickerTarget.stopId)!.lat!, lng: stops.find(s => s.id === mapPickerTarget.stopId)!.lng! }
                                : null
                            : null;

        return (
            <LocationPickerMap
                initialLocation={initialLocation}
                onConfirm={handleMapConfirm}
                onCancel={() => {
                    setShowMapPicker(false);
                    setMapPickerTarget(null);
                }}
            />
        );
    }

    // Mode Selection - DiDi Style Light Theme
    if (step === "mode") {
        return (
            <div className="min-h-screen bg-white">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 pt-10 pb-6">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/80 mb-3"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-xl font-bold text-white">¿Qué necesitas?</h1>
                    <p className="text-white/80 text-sm">Selecciona el tipo de servicio</p>
                </div>

                {/* Options Grid */}
                <div className="p-4 -mt-3">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Shopping Option */}
                        <div
                            onClick={() => {
                                setMandaditoType("shopping");
                                setStep("stops");
                            }}
                            className="bg-white rounded-xl p-4 shadow-md border-2 border-transparent hover:border-orange-300 transition-all cursor-pointer flex flex-col items-center text-center active:scale-95"
                        >
                            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                                <ShoppingBag className="h-6 w-6 text-orange-500" />
                            </div>
                            <h3 className="font-bold text-gray-900 text-sm">Compras</h3>
                            <p className="text-gray-500 text-xs mt-1">Tiendas, farmacias, super...</p>
                        </div>

                        {/* Payment/Deposit Option - DISABLED */}
                        <div
                            onClick={() => {
                                toast.info("Esta función estará disponible próximamente");
                            }}
                            className="bg-white rounded-xl p-4 shadow-md border-2 border-gray-200 transition-all cursor-not-allowed flex flex-col items-center text-center opacity-60 relative"
                        >
                            {/* Coming Soon Badge */}
                            <div className="absolute -top-2 -right-2 bg-gray-500 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                                Próximamente
                            </div>
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2 relative">
                                <CreditCard className="h-6 w-6 text-gray-400" />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-500 rounded-full flex items-center justify-center">
                                    <Lock className="h-3 w-3 text-white" />
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-400 text-sm">Pagos</h3>
                            <p className="text-gray-400 text-xs mt-1">Depósitos, pagos de luz...</p>
                        </div>

                        {/* Package Pickup/Delivery Option */}
                        <div
                            onClick={() => {
                                setMandaditoType("delivery");
                                setStep("delivery");
                            }}
                            className="bg-white rounded-xl p-4 shadow-md border-2 border-transparent hover:border-blue-300 transition-all cursor-pointer flex flex-col items-center text-center active:scale-95"
                        >
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                                <Package className="h-6 w-6 text-blue-500" />
                            </div>
                            <h3 className="font-bold text-gray-900 text-sm">Paquete</h3>
                            <p className="text-gray-500 text-xs mt-1">Recoger y entregar</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Shopping: Stops Editor - Light Theme with Map
    if (step === "stops") {
        return (
            <div className="min-h-screen bg-gray-50 pb-28">
                {/* Header */}
                <div className="bg-white px-6 pt-12 pb-6 shadow-sm">
                    <button
                        onClick={() => setStep("mode")}
                        className="flex items-center gap-2 text-gray-500 mb-4"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm">Atrás</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Agrega tus paradas</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Cada parada es una tienda donde compraremos algo
                    </p>
                </div>

                {/* Stops List */}
                <div className="p-4 space-y-4">
                    {stops.map((stop, index) => (
                        <div
                            key={stop.id}
                            className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100"
                        >
                            {/* Stop Header */}
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer"
                                onClick={() => toggleStopExpand(stop.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {stop.address || `Parada ${index + 1}`}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {stop.items.length} producto(s)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setStopToDeleteId(stop.id);
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors mr-1"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span className="text-xs font-medium">Eliminar</span>
                                    </button>
                                    {stop.isExpanded ? (
                                        <ChevronUp className="h-5 w-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="h-5 w-5 text-gray-400" />
                                    )}
                                </div>
                            </div>

                            {/* Stop Content (Expanded) */}
                            {stop.isExpanded && (
                                <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                                    {/* Store Name - Primary Input */}
                                    <div className="pt-4">
                                        <label className="text-xs text-gray-500 mb-1 block font-medium">
                                            Nombre de tienda o lugar
                                        </label>
                                        <Input
                                            placeholder="Ej: Abarrotes Don Pepe, Farmacia del Ahorro..."
                                            value={stop.address}
                                            onChange={(e) =>
                                                updateStop(stop.id, "address", e.target.value)
                                            }
                                            className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl"
                                        />
                                    </div>

                                    {/* Map Location - Optional */}
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block font-medium">
                                            Ubicación en mapa (opcional)
                                        </label>
                                        <button
                                            className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 hover:border-orange-300 transition-colors text-left"
                                            onClick={() => openMapPicker({ stopId: stop.id })}
                                        >
                                            <MapPin className={`h-5 w-5 ${stop.lat ? 'text-green-500' : 'text-gray-400'}`} />
                                            <span className={`flex-1 text-sm ${stop.lat ? 'text-green-600' : 'text-gray-400'}`}>
                                                {stop.lat ? '📍 Ubicación marcada' : 'Añadir punto en mapa'}
                                            </span>
                                            <Navigation className="h-4 w-4 text-gray-400" />
                                        </button>
                                    </div>

                                    {/* Instructions */}
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block font-medium">
                                            Instrucciones (opcional)
                                        </label>
                                        <Input
                                            placeholder="Ej: Preguntar por ofertas, pedir factura..."
                                            value={stop.instructions}
                                            onChange={(e) =>
                                                updateStop(stop.id, "instructions", e.target.value)
                                            }
                                            className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl"
                                        />
                                    </div>

                                    {/* Items List */}
                                    <div>
                                        <label className="text-xs text-gray-500 mb-2 block font-medium">
                                            Lista de compras
                                        </label>

                                        <div className="space-y-2">
                                            {stop.items.map((item, itemIndex) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-2 bg-gray-50 rounded-xl p-3"
                                                >
                                                    <span className="text-gray-400 text-xs w-5">
                                                        {itemIndex + 1}.
                                                    </span>
                                                    <Input
                                                        placeholder="Ej: 1 kg de arroz, 2 litros de leche..."
                                                        value={item.name}
                                                        onChange={(e) =>
                                                            updateItem(
                                                                stop.id,
                                                                item.id,
                                                                "name",
                                                                e.target.value
                                                            )
                                                        }
                                                        className="flex-1 bg-transparent border-0 text-gray-900 h-8 p-0 focus-visible:ring-0"
                                                    />
                                                    <button
                                                        onClick={() => removeItem(stop.id, item.id)}
                                                        className="p-1 text-red-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-3 border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 hover:text-orange-600 w-full rounded-xl"
                                            onClick={() => addItem(stop.id)}
                                        >
                                            <Plus className="h-4 w-4 mr-1" /> Agregar producto
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add Stop Button */}
                    <Button
                        variant="outline"
                        className="w-full border-dashed border-orange-400 text-orange-500 hover:bg-orange-50 hover:text-orange-600 h-14 rounded-2xl"
                        onClick={addStop}
                    >
                        <Plus className="h-5 w-5 mr-2" /> Agregar parada
                    </Button>

                    {stops.length === 0 && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Store className="h-8 w-8 text-orange-500" />
                            </div>
                            <p className="text-gray-500 text-sm">
                                Agrega las tiendas donde quieres que compremos
                            </p>
                        </div>
                    )}
                </div>

                {/* Fixed Bottom */}
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
                    <Button
                        className="w-full h-14 text-lg font-semibold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200"
                        disabled={stops.length === 0}
                        onClick={() => setStep("confirm")}
                    >
                        Continuar ({stops.length} parada{stops.length !== 1 ? "s" : ""})
                    </Button>
                </div>

                {/* Delete Confirmation Modal */}
                <Dialog open={!!stopToDeleteId} onOpenChange={(open) => !open && setStopToDeleteId(null)}>
                    <DialogContent className="sm:max-w-md rounded-2xl w-[90%] mx-auto">
                        <DialogHeader>
                            <DialogTitle>¿Eliminar esta parada?</DialogTitle>
                            <DialogDescription>
                                Se eliminará la tienda y todos los productos de la lista.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-3 justify-end mt-4">
                            <Button variant="outline" onClick={() => setStopToDeleteId(null)} className="flex-1 rounded-xl h-12 border-gray-200">
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    if (stopToDeleteId) removeStop(stopToDeleteId);
                                    setStopToDeleteId(null);
                                }}
                                className="flex-1 rounded-xl h-12 bg-red-500 hover:bg-red-600 text-white"
                            >
                                Eliminar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Delivery: Point to Point - Light Theme with Map
    if (step === "delivery") {
        return (
            <div className="min-h-screen bg-gray-50 pb-28">
                {/* Header */}
                <div className="bg-white px-6 pt-12 pb-6 shadow-sm">
                    <button
                        onClick={() => setStep("mode")}
                        className="flex items-center gap-2 text-gray-500 mb-4"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm">Atrás</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Envío de Paquete</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        ¿De dónde a dónde llevamos tu paquete?
                    </p>
                </div>

                <div className="p-4 space-y-4">
                    {/* Pickup Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-emerald-600 mb-4">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span className="font-semibold">Recoger en</span>
                        </div>
                        <div className="space-y-3">
                            {/* Map Address Picker */}
                            <div
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-emerald-300 transition-colors"
                                onClick={() => openMapPicker("pickup")}
                            >
                                <MapPin className="h-5 w-5 text-emerald-500" />
                                <span className={`flex-1 ${pickupAddress ? "text-gray-900" : "text-gray-400"}`}>
                                    {pickupAddress || "Seleccionar ubicación en mapa"}
                                </span>
                                <Navigation className="h-4 w-4 text-gray-400" />
                            </div>
                            <Input
                                placeholder="Instrucciones (qué es, a quién pedir...)"
                                value={pickupInstructions}
                                onChange={(e) => setPickupInstructions(e.target.value)}
                                className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl text-sm"
                            />
                        </div>
                    </div>

                    {/* Connector Line */}
                    <div className="flex justify-center">
                        <div className="w-0.5 h-8 bg-gray-200" />
                    </div>

                    {/* Destination Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-red-500 mb-4">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="font-semibold">Entregar en</span>
                        </div>
                        <div className="space-y-3">
                            {/* Map Address Picker */}
                            <div
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-red-300 transition-colors"
                                onClick={() => openMapPicker("destination")}
                            >
                                <MapPin className="h-5 w-5 text-red-500" />
                                <span className={`flex-1 ${destinationAddress ? "text-gray-900" : "text-gray-400"}`}>
                                    {destinationAddress || "Seleccionar ubicación en mapa"}
                                </span>
                                <Navigation className="h-4 w-4 text-gray-400" />
                            </div>
                            <Input
                                placeholder="Instrucciones (a quién entregar...)"
                                value={destinationInstructions}
                                onChange={(e) => setDestinationInstructions(e.target.value)}
                                className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Fixed Bottom */}
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
                    <Button
                        className="w-full h-14 text-lg font-semibold rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200"
                        disabled={!pickupAddress.trim() || !destinationAddress.trim() || isSubmitting}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Solicitar Mandadito"
                        )}
                    </Button>
                </div>

                {/* Delete Confirmation Modal (Reused) */}
                <Dialog open={!!stopToDeleteId} onOpenChange={(open) => !open && setStopToDeleteId(null)}>
                    <DialogContent className="sm:max-w-md rounded-2xl w-[90%] mx-auto">
                        <DialogHeader>
                            <DialogTitle>¿Eliminar esta parada?</DialogTitle>
                            <DialogDescription>
                                Se eliminará la tienda y todos los productos de la lista.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-3 justify-end mt-4">
                            <Button variant="outline" onClick={() => setStopToDeleteId(null)} className="flex-1 rounded-xl h-12 border-gray-200">
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    if (stopToDeleteId) removeStop(stopToDeleteId);
                                    setStopToDeleteId(null);
                                }}
                                className="flex-1 rounded-xl h-12 bg-red-500 hover:bg-red-600 text-white"
                            >
                                Eliminar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // Payment: Pickup money -> Pay at location
    if (step === "payment") {
        return (
            <div className="min-h-screen bg-gray-50 pb-28">
                {/* Header */}
                <div className="bg-white px-6 pt-12 pb-6 shadow-sm">
                    <button
                        onClick={() => setStep("mode")}
                        className="flex items-center gap-2 text-gray-500 mb-4"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm">Atrás</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Pago o Depósito</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Te recogemos el dinero y hacemos el pago
                    </p>
                </div>

                <div className="p-4 space-y-4">
                    {/* Payment Type Selector */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                        <label className="text-xs text-gray-500 mb-3 block font-medium">
                            ¿Qué tipo de pago es?
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => setPaymentType("deposit")}
                                className={`p-3 rounded-xl border-2 transition-all ${paymentType === "deposit"
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-200 bg-gray-50"
                                    }`}
                            >
                                <p className={`text-xs font-semibold ${paymentType === "deposit" ? "text-green-600" : "text-gray-700"}`}>
                                    Depósito
                                </p>
                            </button>
                            <button
                                onClick={() => setPaymentType("bill")}
                                className={`p-3 rounded-xl border-2 transition-all ${paymentType === "bill"
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-200 bg-gray-50"
                                    }`}
                            >
                                <p className={`text-xs font-semibold ${paymentType === "bill" ? "text-green-600" : "text-gray-700"}`}>
                                    Servicio
                                </p>
                            </button>
                            <button
                                onClick={() => setPaymentType("other")}
                                className={`p-3 rounded-xl border-2 transition-all ${paymentType === "other"
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-200 bg-gray-50"
                                    }`}
                            >
                                <p className={`text-xs font-semibold ${paymentType === "other" ? "text-green-600" : "text-gray-700"}`}>
                                    Otro
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* Pickup Card - Where to get the money */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-blue-600 mb-4">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="font-semibold">Recoger dinero en</span>
                        </div>
                        <div className="space-y-3">
                            {/* Map Address Picker */}
                            <div
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 transition-colors"
                                onClick={() => openMapPicker("pickup")}
                            >
                                <MapPin className="h-5 w-5 text-blue-500" />
                                <span className={`flex-1 ${pickupAddress ? "text-gray-900" : "text-gray-400"}`}>
                                    {pickupAddress || "Seleccionar tu ubicación"}
                                </span>
                                <Navigation className="h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {/* Connector Line */}
                    <div className="flex justify-center">
                        <div className="w-0.5 h-8 bg-gray-200" />
                    </div>

                    {/* Payment Location Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-green-600 mb-4">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="font-semibold">Pagar en</span>
                        </div>
                        <div className="space-y-3">
                            {/* Location Name */}
                            <Input
                                placeholder="Nombre del lugar (Ej: Banco Azteca, Oxxo, CFE...)"
                                value={paymentLocationName}
                                onChange={(e) => setPaymentLocationName(e.target.value)}
                                className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl"
                            />
                            {/* Map Address Picker */}
                            <div
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-green-300 transition-colors"
                                onClick={() => openMapPicker("paymentLocation")}
                            >
                                <MapPin className="h-5 w-5 text-green-500" />
                                <span className={`flex-1 ${destinationAddress ? "text-gray-900" : "text-gray-400"}`}>
                                    {destinationAddress || "Seleccionar ubicación en mapa"}
                                </span>
                                <Navigation className="h-4 w-4 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <h3 className="font-semibold text-gray-900 mb-4">Detalles del pago</h3>
                        <div className="space-y-3">
                            {/* Amount */}
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block font-medium">
                                    Monto a pagar *
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0.00"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                                        className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl pl-8 text-lg font-semibold"
                                    />
                                </div>
                            </div>

                            {/* Reference */}
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block font-medium">
                                    {paymentType === "deposit" ? "Número de cuenta/tarjeta" : "Número de servicio/referencia"}
                                </label>
                                <Input
                                    placeholder={paymentType === "deposit" ? "Ej: 4152 3138 0000 1234" : "Ej: 1234567890"}
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl"
                                />
                            </div>

                            {/* Instructions */}
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block font-medium">
                                    Instrucciones adicionales
                                </label>
                                <Input
                                    placeholder="Ej: Nombre del titular, tipo de servicio..."
                                    value={paymentInstructions}
                                    onChange={(e) => setPaymentInstructions(e.target.value)}
                                    className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fixed Bottom */}
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
                    <Button
                        className="w-full h-14 text-lg font-semibold rounded-xl bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200"
                        disabled={!pickupAddress.trim() || !destinationAddress.trim() || !paymentAmount.trim() || isSubmitting}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            `Solicitar Pago de $${paymentAmount || '0'}`
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    // Confirm: Delivery Address (for shopping mode) - Light Theme with Map
    if (step === "confirm") {
        const totalItems = stops.reduce((acc, s) => acc + s.items.length, 0);

        return (
            <div className="min-h-screen bg-gray-50 pb-28">
                {/* Header */}
                <div className="bg-white px-6 pt-12 pb-6 shadow-sm">
                    <button
                        onClick={() => setStep("stops")}
                        className="flex items-center gap-2 text-gray-500 mb-4"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm">Atrás</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">¿Dónde te entregamos?</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Visitaremos {stops.length} tienda(s) y te lo llevamos
                    </p>
                </div>

                <div className="p-4 space-y-4">
                    {/* Summary Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900">Resumen de tu pedido</h3>
                            <button
                                onClick={() => setStep("stops")}
                                className="text-orange-500 text-sm font-medium hover:text-orange-600"
                            >
                                Editar lista
                            </button>
                        </div>
                        <div className="space-y-3">
                            {stops.map((stop, i) => (
                                <div key={stop.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                                            {i + 1}
                                        </div>
                                        <span className="text-gray-700 text-sm">
                                            {stop.address || "Parada sin nombre"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 text-sm">{stop.items.length} items</span>
                                        <button
                                            onClick={() => setStopToDeleteId(stop.id)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between">
                            <span className="text-gray-500 font-medium">Total productos</span>
                            <span className="text-gray-900 font-bold">{totalItems}</span>
                        </div>
                    </div>

                    {/* Delivery Address Card */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 text-orange-500 mb-4">
                            <MapPin className="h-5 w-5" />
                            <span className="font-semibold">Tu dirección de entrega</span>
                        </div>
                        <div className="space-y-3">
                            {/* Map Address Picker */}
                            <div
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-orange-300 transition-colors"
                                onClick={() => openMapPicker("delivery")}
                            >
                                <MapPin className="h-5 w-5 text-orange-500" />
                                <span className={`flex-1 ${deliveryAddress ? "text-gray-900" : "text-gray-400"}`}>
                                    {deliveryAddress || "Seleccionar ubicación en mapa"}
                                </span>
                                <Navigation className="h-4 w-4 text-gray-400" />
                            </div>
                            <Input
                                placeholder="Referencias (opcional)"
                                value={deliveryReferences}
                                onChange={(e) => setDeliveryReferences(e.target.value)}
                                className="bg-gray-50 border-gray-200 text-gray-900 rounded-xl text-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Fixed Bottom */}
                <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
                    <Button
                        className="w-full h-14 text-lg font-semibold rounded-xl bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200"
                        disabled={!deliveryAddress.trim() || isSubmitting}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "Solicitar Mandadito"
                        )}
                    </Button>
                </div>

                {/* Delete Confirmation Modal (Reused) */}
                <Dialog open={!!stopToDeleteId} onOpenChange={(open) => !open && setStopToDeleteId(null)}>
                    <DialogContent className="sm:max-w-md rounded-2xl w-[90%] mx-auto">
                        <DialogHeader>
                            <DialogTitle>¿Eliminar esta parada?</DialogTitle>
                            <DialogDescription>
                                Se eliminará la tienda y todos los productos de la lista.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex gap-3 justify-end mt-4">
                            <Button variant="outline" onClick={() => setStopToDeleteId(null)} className="flex-1 rounded-xl h-12 border-gray-200">
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    if (stopToDeleteId) removeStop(stopToDeleteId);
                                    setStopToDeleteId(null);
                                }}
                                className="flex-1 rounded-xl h-12 bg-red-500 hover:bg-red-600 text-white"
                            >
                                Eliminar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return null;
}
