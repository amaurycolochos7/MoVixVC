"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Loader2, Check, Pencil, ShieldCheck, Phone, Mail, ChevronRight, CreditCard, Building } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AvatarUpload } from "@/components/profile/avatar-upload";

export default function MandaditoPerfilPage() {
    const { profile, signOut, refreshProfile, loading } = useAuth();
    const router = useRouter();
    const supabase = createClient();

    const [isEditing, setIsEditing] = useState(false);
    const [isEditingBank, setIsEditingBank] = useState(false);
    const [fullName, setFullName] = useState(profile?.full_name || "");
    const [saving, setSaving] = useState(false);

    // Bank info states
    const [bankClabe, setBankClabe] = useState("");
    const [bankCardNumber, setBankCardNumber] = useState("");
    const [bankHolderName, setBankHolderName] = useState("");
    const [bankName, setBankName] = useState("");

    // Load bank info on mount
    useEffect(() => {
        const loadBankInfo = async () => {
            if (!profile?.id) return;

            const { data } = await supabase
                .from("users")
                .select("bank_clabe, bank_card_number, bank_holder_name, bank_name")
                .eq("id", profile.id)
                .single();

            if (data) {
                setBankClabe(data.bank_clabe || "");
                setBankCardNumber(data.bank_card_number || "");
                setBankHolderName(data.bank_holder_name || "");
                setBankName(data.bank_name || "");
            }
        };
        loadBankInfo();
    }, [profile?.id]);

    if (loading || !profile) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
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
        } catch {
            toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveBankInfo = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from("users")
                .update({
                    bank_clabe: bankClabe || null,
                    bank_card_number: bankCardNumber || null,
                    bank_holder_name: bankHolderName || null,
                    bank_name: bankName || null
                })
                .eq("id", profile.id);

            if (error) throw error;

            setIsEditingBank(false);
            toast.success("Datos bancarios guardados");
        } catch {
            toast.error("Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    const isVerified = profile.kyc_status === 'approved';
    const hasBankInfo = bankClabe || bankCardNumber;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-5 pt-8 pb-16">
                <h1 className="text-xl font-bold text-white">Mi Perfil</h1>
            </div>

            {/* Profile Card - Overlapping header */}
            <div className="px-4 -mt-12">
                <div className="bg-white rounded-2xl shadow-lg p-5">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4 mb-4">
                        <AvatarUpload
                            currentAvatarUrl={profile.avatar_url}
                            userId={profile.id}
                            onUploadComplete={refreshProfile}
                        />
                        <div className="flex-1 min-w-0">
                            {isEditing ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="h-9 text-base"
                                        autoFocus
                                    />
                                    <Button size="sm" onClick={handleSaveName} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-lg text-gray-900 truncate">{profile.full_name || "Sin nombre"}</h2>
                                    <button
                                        onClick={() => {
                                            setFullName(profile.full_name || "");
                                            setIsEditing(true);
                                        }}
                                        className="p-1.5 rounded-full hover:bg-gray-100"
                                    >
                                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                    </button>
                                </div>
                            )}

                            {/* Verification Badge */}
                            {isVerified && (
                                <div className="flex items-center gap-1 mt-1">
                                    <ShieldCheck className="h-4 w-4 text-green-500" />
                                    <span className="text-xs text-green-600 font-medium">Verificado</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                                <Mail className="h-4 w-4 text-gray-500" />
                            </div>
                            <span className="text-sm text-gray-700">{profile.email}</span>
                        </div>

                        {profile.phone && (
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                                    <Phone className="h-4 w-4 text-gray-500" />
                                </div>
                                <span className="text-sm text-gray-700">{profile.phone}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bank Info Card */}
            <div className="px-4 mt-4">
                <div className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-blue-500" />
                            <h3 className="font-semibold text-gray-900">Datos para Cobro</h3>
                        </div>
                        {!isEditingBank && (
                            <button
                                onClick={() => setIsEditingBank(true)}
                                className="text-sm text-orange-500 font-medium"
                            >
                                {hasBankInfo ? 'Editar' : 'Agregar'}
                            </button>
                        )}
                    </div>

                    {isEditingBank ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Banco</label>
                                <Input
                                    value={bankName}
                                    onChange={(e) => setBankName(e.target.value)}
                                    placeholder="Ej: BBVA, Santander..."
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Nombre del titular</label>
                                <Input
                                    value={bankHolderName}
                                    onChange={(e) => setBankHolderName(e.target.value)}
                                    placeholder="Nombre completo"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">CLABE (18 dígitos)</label>
                                <Input
                                    value={bankClabe}
                                    onChange={(e) => setBankClabe(e.target.value.replace(/\D/g, '').slice(0, 18))}
                                    placeholder="000000000000000000"
                                    maxLength={18}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">Número de tarjeta (opcional)</label>
                                <Input
                                    value={bankCardNumber}
                                    onChange={(e) => setBankCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                                    placeholder="0000000000000000"
                                    maxLength={16}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditingBank(false)}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSaveBankInfo}
                                    disabled={saving}
                                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                                >
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Guardar
                                </Button>
                            </div>
                        </div>
                    ) : hasBankInfo ? (
                        <div className="space-y-3">
                            {bankName && (
                                <div className="flex items-center gap-3">
                                    <Building className="h-4 w-4 text-gray-400" />
                                    <span className="text-sm text-gray-700">{bankName}</span>
                                </div>
                            )}
                            {bankHolderName && (
                                <div className="text-sm text-gray-700">
                                    <span className="text-gray-500">Titular: </span>{bankHolderName}
                                </div>
                            )}
                            {bankClabe && (
                                <div className="font-mono text-sm text-gray-900 bg-gray-50 p-2 rounded">
                                    CLABE: {bankClabe.replace(/(\d{4})/g, '$1 ').trim()}
                                </div>
                            )}
                            {bankCardNumber && (
                                <div className="font-mono text-sm text-gray-700">
                                    Tarjeta: •••• {bankCardNumber.slice(-4)}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <p className="text-gray-500 text-sm mb-2">
                                Agrega tus datos para que los clientes puedan pagarte por transferencia
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Menu Options */}
            <div className="px-4 mt-4">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                                <LogOut className="h-4 w-4 text-red-500" />
                            </div>
                            <span className="text-red-600 font-medium">Cerrar Sesión</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300" />
                    </button>
                </div>
            </div>
        </div>
    );
}
