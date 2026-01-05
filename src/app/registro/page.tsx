"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Lock, User, Phone, Car, Package, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function RegistroPage() {
    const router = useRouter();
    const supabase = createClient();

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        phone: "",
        role: "cliente",
        // Vehicle data (only for taxi/mandadito)
        vehicleBrand: "",
        vehicleModel: "",
        vehicleColor: "",
        vehiclePlate: "",
        taxiNumber: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        if (formData.password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        // Validations for drivers
        if (formData.role !== "cliente") {
            if (!formData.phone) {
                toast.error("El teléfono es obligatorio para conductores");
                return;
            }
            // Limpiar el teléfono de espacios y guiones para validar
            const cleanPhone = formData.phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                toast.error("El teléfono debe tener exactamente 10 dígitos");
                return;
            }
            if (!formData.vehicleBrand || !formData.vehicleModel ||
                !formData.vehicleColor || !formData.vehiclePlate || !formData.taxiNumber) {
                toast.error("Todos los datos del vehículo son obligatorios");
                return;
            }
        }

        setLoading(true);

        try {
            // Create auth user with metadata - trigger will create profile
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        phone: formData.phone || null,
                        role: formData.role,
                    }
                }
            });

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error("No se pudo crear el usuario");
            }

            // If driver, insert vehicle data
            if (formData.role !== "cliente") {
                // Esperar un momento para que el trigger termine de crear el perfil
                // Evitamos consultar la tabla users directamente para prevenir errores de permisos/RLS durante el registro
                await new Promise(resolve => setTimeout(resolve, 2500));

                const { error: vehicleError } = await supabase
                    .from("driver_vehicles")
                    .insert({
                        user_id: authData.user.id,
                        brand: formData.vehicleBrand,
                        model: formData.vehicleModel,
                        color: formData.vehicleColor,
                        plate_number: formData.vehiclePlate.toUpperCase(),
                        taxi_number: formData.taxiNumber,
                    });

                if (vehicleError) throw vehicleError;
            }

            // Different messages based on role
            if (formData.role === "cliente") {
                toast.success("Cuenta creada. Revisa tu email para verificar.");
            } else {
                toast.success("Cuenta creada. Tu solicitud será revisada por un administrador.");
            }

            router.push("/login");

        } catch (err: any) {
            console.error("Registration error:", err);
            if (err.message.includes("already registered")) {
                toast.error("Este email ya está registrado");
            } else {
                toast.error(err.message || "Error al crear cuenta");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-surface p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
                    <p className="text-sm text-muted-foreground">Únete a MoVix</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Nombre completo</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="fullName"
                                    placeholder="Tu nombre"
                                    value={formData.fullName}
                                    onChange={(e) => handleChange("fullName", e.target.value)}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Correo electrónico</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={formData.email}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono (opcional)</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="55 1234 5678"
                                    value={formData.phone}
                                    onChange={(e) => handleChange("phone", e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>¿Cómo usarás MoVix?</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(val: string) => handleChange("role", val)}
                            >
                                <SelectTrigger className="w-full h-12 bg-white border-2 border-gray-200 focus:border-primary text-gray-900">
                                    <SelectValue placeholder="Selecciona tu rol" />
                                </SelectTrigger>
                                <SelectContent
                                    className="z-50 bg-white border border-gray-200 shadow-xl rounded-lg"
                                    position="popper"
                                    sideOffset={4}
                                >
                                    <SelectItem value="cliente" className="py-3 cursor-pointer hover:bg-indigo-50">
                                        <div className="flex items-center gap-3">
                                            <User className="w-5 h-5 text-primary" />
                                            <div>
                                                <div className="font-medium text-gray-900">Soy Cliente</div>
                                                <div className="text-xs text-gray-500">Pedir taxi o mandadito</div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="taxi" className="py-3 cursor-pointer hover:bg-green-50">
                                        <div className="flex items-center gap-3">
                                            <Car className="w-5 h-5 text-secondary" />
                                            <div>
                                                <div className="font-medium text-gray-900">Soy Chofer de Taxi</div>
                                                <div className="text-xs text-gray-500">Recibir solicitudes de viaje</div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="mandadito" className="py-3 cursor-pointer hover:bg-orange-50">
                                        <div className="flex items-center gap-3">
                                            <Package className="w-5 h-5 text-orange-500" />
                                            <div>
                                                <div className="font-medium text-gray-900">Soy Mandadito</div>
                                                <div className="text-xs text-gray-500">Hacer entregas y encargos</div>
                                            </div>
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Vehicle Data Section - Only for drivers */}
                        {(formData.role === "taxi" || formData.role === "mandadito") && (
                            <div className="mt-6 pt-6 border-t-2 border-gray-200 space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Car className="w-5 h-5 text-primary" />
                                    Datos del Vehículo
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Todos los campos son obligatorios
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vehicleBrand">Marca</Label>
                                        <Input
                                            id="vehicleBrand"
                                            placeholder="Nissan, Toyota, etc."
                                            value={formData.vehicleBrand}
                                            onChange={(e) => handleChange("vehicleBrand", e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="vehicleModel">Modelo</Label>
                                        <Input
                                            id="vehicleModel"
                                            placeholder="Versa 2020"
                                            value={formData.vehicleModel}
                                            onChange={(e) => handleChange("vehicleModel", e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="vehicleColor">Color</Label>
                                    <Input
                                        id="vehicleColor"
                                        placeholder="Blanco, Verde, Blanco con azul, etc."
                                        value={formData.vehicleColor}
                                        onChange={(e) => handleChange("vehicleColor", e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vehiclePlate">Placas</Label>
                                        <Input
                                            id="vehiclePlate"
                                            placeholder="ABC-1234"
                                            value={formData.vehiclePlate}
                                            onChange={(e) => handleChange("vehiclePlate", e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="taxiNumber">Número de Taxi</Label>
                                        <Input
                                            id="taxiNumber"
                                            placeholder="1234"
                                            value={formData.taxiNumber}
                                            onChange={(e) => handleChange("taxiNumber", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Mínimo 6 caracteres"
                                    value={formData.password}
                                    onChange={(e) => handleChange("password", e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Repite tu contraseña"
                                    value={formData.confirmPassword}
                                    onChange={(e) => handleChange("confirmPassword", e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                "Crear Cuenta"
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
                        <Link href="/login" className="text-primary font-medium hover:underline">
                            Inicia sesión
                        </Link>
                    </div>

                    <div className="mt-4 text-center">
                        <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                            ← Volver al inicio
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
