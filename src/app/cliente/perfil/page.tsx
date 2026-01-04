"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { User, Settings, LogOut, Loader2, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AvatarUpload } from "@/components/profile/avatar-upload";

export default function ClientePerfilPage() {
    const { user, profile, signOut, refreshProfile, loading } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [isEditing, setIsEditing] = useState(false);
    const [fullName, setFullName] = useState(profile?.full_name || "");
    const [saving, setSaving] = useState(false);

    // Show loading only during initial auth check
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // No user = redirect to login
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-text-secondary">No has iniciado sesión</p>
                <Button onClick={() => router.push("/")}>Iniciar Sesión</Button>
            </div>
        );
    }

    // User exists but no profile yet (still loading profile or profile doesn't exist)
    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-text-secondary text-sm">Cargando perfil...</p>
                <Button variant="ghost" size="sm" onClick={() => signOut().then(() => router.push("/"))}>
                    ¿Problemas? Cerrar sesión
                </Button>
            </div>
        );
    }

    const handleSaveName = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from("users")
                .update({ full_name: fullName })
                .eq("id", profile.id);

            if (error) throw error;

            await refreshProfile();
            setIsEditing(false);
            toast.success("Nombre actualizado");
        } catch (err) {
            toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-bold">Mi Perfil</h1>

            {/* Avatar + Basic Info */}
            <div className="flex items-center gap-4 py-4">
                <AvatarUpload
                    currentAvatarUrl={profile.avatar_url}
                    userId={profile.id}
                    onUploadComplete={refreshProfile}
                />
                <div className="flex-1">
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="h-9"
                            />
                            <Button size="sm" onClick={handleSaveName} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold">{profile.full_name || "Sin nombre"}</h2>
                            <Button variant="ghost" size="sm" onClick={() => {
                                setFullName(profile.full_name || "");
                                setIsEditing(true);
                            }}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    <p className="text-sm text-text-secondary">{profile.email}</p>
                    {profile.phone && (
                        <p className="text-sm text-text-secondary">{profile.phone}</p>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
                <Card>
                    <CardContent className="p-0">
                        <Button
                            variant="ghost"
                            className="w-full justify-start rounded-none h-14 px-6 text-danger hover:text-danger hover:bg-danger/10"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-3 h-5 w-5" /> Cerrar Sesión
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
