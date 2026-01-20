"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { User, Car, LogOut, Loader2, Check, Pencil, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { DriverRatingStats } from "@/components/rating";

const KYC_STATUS_MAP: Record<string, { icon: any; label: string; color: string }> = {
    approved: { icon: ShieldCheck, label: "Verificado", color: "text-green-600" },
    pending: { icon: Clock, label: "Pendiente", color: "text-yellow-600" },
    rejected: { icon: ShieldAlert, label: "Rechazado", color: "text-red-600" },
};

export default function TaxiPerfilPage() {
    const { profile, signOut, refreshProfile, loading } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [isEditing, setIsEditing] = useState(false);
    const [fullName, setFullName] = useState(profile?.full_name || "");
    const [saving, setSaving] = useState(false);

    if (loading || !profile) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const kycInfo = KYC_STATUS_MAP[profile.kyc_status] || KYC_STATUS_MAP.pending;
    const KycIcon = kycInfo.icon;

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
        <div className="p-6 space-y-6">
            <h1 className="text-xl font-bold">Perfil Conductor</h1>

            {/* KYC Status Badge */}
            <Card className={`border-2 ${profile.kyc_status === 'approved' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
                <CardContent className="p-3 flex items-center gap-3">
                    <KycIcon className={`h-5 w-5 ${kycInfo.color}`} />
                    <div>
                        <p className={`font-medium ${kycInfo.color}`}>{kycInfo.label}</p>
                        <p className="text-xs text-muted-foreground">
                            {profile.kyc_status === 'approved'
                                ? "Puedes recibir solicitudes"
                                : "Tu documentación está siendo revisada"}
                        </p>
                    </div>
                </CardContent>
            </Card>

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

            {/* Rating Stats */}
            <DriverRatingStats
                driverId={profile.id}
                ratingAvg={profile.rating_avg || 0}
                ratingCount={profile.rating_count || 0}
            />

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
