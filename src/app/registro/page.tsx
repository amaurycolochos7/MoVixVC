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
import { OTPVerification } from "@/components/auth/otp-verification";

// Registration steps
type RegistrationStep = "form" | "otp" | "complete";

export default function RegistroPage() {
    const router = useRouter();
    const supabase = createClient();

    const [step, setStep] = useState<RegistrationStep>("form");
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

    // Send OTP to email
    const sendOTP = async () => {
        const response = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: formData.email,
                name: formData.fullName,
                type: "registration"
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Error al enviar código");
        }

        // In development, show the code for testing
        if (data.devCode) {
            console.log("[DEV] OTP Code:", data.devCode);
            toast.info(`[DEV] Código: ${data.devCode}`, { duration: 10000 });
        }

        return data;
    };

    // Validate form and send OTP
    const handleSubmitForm = async (e: React.FormEvent) => {
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
            const cleanPhone = formData.phone.replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                toast.error("El teléfono debe tener exactamente 10 dígitos");
                return;
            }

            if (formData.role === "taxi") {
                if (!formData.vehicleBrand || !formData.vehicleModel ||
                    !formData.vehicleColor || !formData.vehiclePlate || !formData.taxiNumber) {
                    toast.error("Todos los datos del vehículo son obligatorios");
                    return;
                }
            } else if (formData.role === "mandadito") {
                if (!formData.vehicleBrand || !formData.vehicleModel || !formData.vehicleColor) {
                    toast.error("Marca, modelo y color de la moto son obligatorios");
                    return;
                }
            }
        }

        setLoading(true);

        try {
            // Send OTP to email
            await sendOTP();
            toast.success("Código de verificación enviado a tu email");
            setStep("otp");
        } catch (err: any) {
            toast.error(err.message || "Error al enviar código de verificación");
        } finally {
            setLoading(false);
        }
    };

    // Complete registration after OTP verified
    const completeRegistration = async () => {
        setLoading(true);

        try {
            // Use admin API to create user with confirmed email
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    fullName: formData.fullName,
                    phone: formData.phone || null,
                    role: formData.role,
                    vehicleData: formData.role !== "cliente" ? {
                        brand: formData.vehicleBrand,
                        model: formData.vehicleModel,
                        color: formData.vehicleColor,
                        plate: formData.vehiclePlate ? formData.vehiclePlate.toUpperCase() : null,
                        taxiNumber: formData.taxiNumber || null,
                    } : null
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Error al crear cuenta");
            }

            // Show appropriate message based on role
            if (data.requiresApproval) {
                toast.success("Cuenta creada. Tu solicitud será revisada por un administrador.");
            } else {
                toast.success("¡Cuenta creada exitosamente!");
            }

            router.push("/login");

        } catch (err: any) {
            console.error("Registration error:", err);
            toast.error(err.message || "Error al crear cuenta");
        } finally {
            setLoading(false);
        }
    };

    // Render OTP verification step
    if (step === "otp") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-surface p-6">
                <OTPVerification
                    email={formData.email}
                    onVerified={completeRegistration}
                    onResend={sendOTP}
                    onBack={() => setStep("form")}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-surface p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
                    <p className="text-sm text-muted-foreground">Únete a MoVix</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmitForm} className="space-y-4">
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

                        {/* Vehicle Data Section - TAXI */}
                        {formData.role === "taxi" && (
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
                                            placeholder="Nissan, Toyota, Chevrolet"
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
                                        placeholder="Blanco, Verde, Rojo"
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

                        {/* Vehicle Data Section - MANDADITO (Motorcycle) */}
                        {formData.role === "mandadito" && (
                            <div className="mt-6 pt-6 border-t-2 border-orange-200 space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    🏍️ Datos de la Motocicleta
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Marca, modelo y color son obligatorios
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vehicleBrand">Marca *</Label>
                                        <Input
                                            id="vehicleBrand"
                                            placeholder="Honda, Italika, Yamaha"
                                            value={formData.vehicleBrand}
                                            onChange={(e) => handleChange("vehicleBrand", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="vehicleModel">Modelo *</Label>
                                        <Input
                                            id="vehicleModel"
                                            placeholder="FT 150, Vento 2022"
                                            value={formData.vehicleModel}
                                            onChange={(e) => handleChange("vehicleModel", e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="vehicleColor">Color *</Label>
                                    <Input
                                        id="vehicleColor"
                                        placeholder="Negro, Rojo, Azul"
                                        value={formData.vehicleColor}
                                        onChange={(e) => handleChange("vehicleColor", e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="vehiclePlate">Placas (opcional)</Label>
                                        <Input
                                            id="vehiclePlate"
                                            placeholder="M12-ABC"
                                            value={formData.vehiclePlate}
                                            onChange={(e) => handleChange("vehiclePlate", e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="taxiNumber">Número Económico (opcional)</Label>
                                        <Input
                                            id="taxiNumber"
                                            placeholder="123"
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
                                    Enviando código...
                                </>
                            ) : (
                                "Continuar"
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
