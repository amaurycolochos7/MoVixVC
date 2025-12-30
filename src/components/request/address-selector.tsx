"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, MapPin, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export interface AddressData {
    full_address: string;
    neighborhood: string;
    address_references: string;
    contact_phone: string;
}

interface AddressSelectorProps {
    label: string;
    value: AddressData | null;
    onChange: (val: AddressData) => void;
}

export function AddressSelector({ label, value, onChange }: AddressSelectorProps) {
    const supabase = createClient();
    const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
    const [mode, setMode] = useState<"select" | "create">("select");
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState<AddressData>({
        full_address: "",
        neighborhood: "",
        address_references: "",
        contact_phone: ""
    });
    const [addressLabel, setAddressLabel] = useState("Casa");
    const [saveNew, setSaveNew] = useState(false);

    useEffect(() => {
        loadAddresses();
    }, []);

    const loadAddresses = async () => {
        setLoading(true);
        const { data } = await supabase.from("client_addresses").select("*").order("is_default", { ascending: false });
        if (data) {
            setSavedAddresses(data);
            // Preselect default if no value
            // if (!value && data.length > 0) {
            //     handleSelect(data[0]);
            // }
        }
        setLoading(false);
    };

    const handleSelect = (addr: any) => {
        onChange({
            full_address: addr.full_address,
            neighborhood: addr.neighborhood,
            address_references: addr.address_references,
            contact_phone: addr.contact_phone
        });
    };

    const handleManualSubmit = async () => {
        onChange(formData);

        if (saveNew) {
            const user = (await supabase.auth.getUser()).data.user;
            if (user) {
                await supabase.from("client_addresses").insert({
                    user_id: user.id,
                    label: addressLabel,
                    ...formData
                });
                await loadAddresses(); // Refresh list
            }
        }
        setMode("select");
    };

    return (
        <div className="space-y-3">
            <Label className="text-base font-semibold">{label}</Label>

            {/* Selection Mode */}
            {mode === "select" && (
                <div className="space-y-3">
                    {savedAddresses.length > 0 && (
                        <Select onValueChange={(val: string) => {
                            if (val === "new") setMode("create");
                            else {
                                const selected = savedAddresses.find(a => a.id === val);
                                if (selected) handleSelect(selected);
                            }
                        }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seleccionar dirección guardada..." />
                            </SelectTrigger>
                            <SelectContent>
                                {savedAddresses.map((addr) => (
                                    <SelectItem key={addr.id} value={addr.id}>
                                        <span className="font-bold">{addr.label}</span> - {addr.full_address}
                                    </SelectItem>
                                ))}
                                <SelectItem value="new">
                                    <span className="text-primary font-semibold flex items-center">
                                        <Plus className="h-4 w-4 mr-2" /> Agregar nueva dirección
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {/* Fallback if no addresses or explicitly creating manual one */}
                    {savedAddresses.length === 0 && (
                        <Button variant="outline" className="w-full" onClick={() => setMode("create")}>
                            <MapPin className="mr-2 h-4 w-4" /> Ingresar dirección
                        </Button>
                    )}

                    {/* Display Selected Value Preview */}
                    {value && (
                        <Card className="bg-slate-50">
                            <CardContent className="p-3 text-sm">
                                <p className="font-medium">{value.full_address}</p>
                                <p className="text-muted-foreground">{value.neighborhood}</p>
                                {value.address_references && <p className="text-xs italic mt-1">Ref: {value.address_references}</p>}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Creation Mode */}
            {mode === "create" && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <div className="space-y-1">
                            <Label>Dirección (Calle y Número)</Label>
                            <Input
                                value={formData.full_address}
                                onChange={e => setFormData({ ...formData, full_address: e.target.value })}
                                placeholder="Ej. Av. Central 123"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Barrio / Colonia</Label>
                            <Input
                                value={formData.neighborhood}
                                onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                                placeholder="Ej. San Juan"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Referencias</Label>
                            <Textarea
                                value={formData.address_references}
                                onChange={e => setFormData({ ...formData, address_references: e.target.value })}
                                placeholder="Portón azul, frente al parque..."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Teléfono de Contacto</Label>
                            <Input
                                value={formData.contact_phone}
                                onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                                placeholder="Opcional"
                            />
                        </div>

                        {/* Save Option */}
                        <div className="pt-2 border-t mt-2">
                            <div className="flex items-center space-x-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="saveAddr"
                                    checked={saveNew}
                                    onChange={e => setSaveNew(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Label htmlFor="saveAddr" className="cursor-pointer">Guardar para futuros viajes</Label>
                            </div>
                            {saveNew && (
                                <Input
                                    value={addressLabel}
                                    onChange={e => setAddressLabel(e.target.value)}
                                    placeholder="Nombre (ej. Casa, Trabajo)"
                                    className="mb-2"
                                />
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={handleManualSubmit}>Confirmar</Button>
                            <Button variant="ghost" onClick={() => setMode("select")}>Cancelar</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
