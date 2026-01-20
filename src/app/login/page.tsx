"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [roleParam, setRoleParam] = useState("cliente");

    // Get role from URL params client-side to avoid useSearchParams pre-rendering issues
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const role = params.get("role") || "cliente";
        setRoleParam(role);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Fetch user profile to get actual role
            const { data: profile } = await supabase
                .from("users")
                .select("role")
                .eq("id", data.user.id)
                .single();

            const userRole = profile?.role || roleParam;

            // Redirect based on role
            const dashboardMap: Record<string, string> = {
                admin: "/admin",
                taxi: "/taxi",
                mandadito: "/mandadito",
                cliente: "/cliente",
            };

            toast.success("Sesión iniciada");
            window.location.href = dashboardMap[userRole] || "/cliente";

        } catch (err: any) {
            if (err.message?.includes("Invalid login")) {
                toast.error("Credenciales incorrectas");
            } else if (err.message?.includes("Email not confirmed")) {
                toast.error("Debes verificar tu email primero");
            } else {
                toast.error(err.message || "Error al iniciar sesión");
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Orange Header */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 pt-12 pb-20 px-6 rounded-b-[40px]">
                <div className="max-w-sm mx-auto text-center">
                    <h1 className="text-3xl font-bold text-white mb-1">MoVix</h1>
                    <p className="text-orange-100 text-sm">Tu App de Movilidad Local</p>
                </div>
            </div>

            {/* Login Card - Overlapping Header */}
            <div className="flex-1 px-6 -mt-12">
                <div className="max-w-sm mx-auto">
                    <Card className="shadow-xl border-0">
                        <CardHeader className="text-center pb-2">
                            <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
                            <p className="text-sm text-muted-foreground">Ingresa a tu cuenta</p>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Correo electrónico</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="tu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 h-11 rounded-xl"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Contraseña</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-10 h-11 rounded-xl"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-12 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Ingresando...
                                        </>
                                    ) : (
                                        "Iniciar Sesión"
                                    )}
                                </Button>
                            </form>

                            <div className="mt-6 text-center text-sm">
                                <span className="text-muted-foreground">¿No tienes cuenta? </span>
                                <Link href="/registro" className="text-orange-500 font-medium hover:underline">
                                    Regístrate
                                </Link>
                            </div>

                            <div className="mt-4 text-center">
                                <Link href="/" className="text-sm text-muted-foreground hover:text-orange-500">
                                    ← Volver al inicio
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
