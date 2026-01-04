"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roleParam = searchParams.get("role") || "cliente";
    const supabase = createClient();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-surface p-6">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
                    <p className="text-sm text-muted-foreground">Ingresa a tu cuenta MoVix</p>
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
                                    className="pl-10"
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
                                    className="pl-10"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
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
                        <Link href="/registro" className="text-primary font-medium hover:underline">
                            Regístrate
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
