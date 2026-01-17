"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Phone, Calendar, User, Trash2, Eye, X, AlertOctagon, Banknote, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface UserData {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: "cliente" | "taxi" | "mandadito" | "admin";
    kyc_status: string;
    created_at: string;
    is_active: boolean;
    balance?: number; // Nuevo campo de saldo
}

export default function AdminUsuariosPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Modals state
    const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
    const [viewModal, setViewModal] = useState<UserData | null>(null);
    const [balanceModal, setBalanceModal] = useState<{ id: string; name: string; currentBalance: number } | null>(null);

    // Balance form state
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");

    const supabase = createClient();

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from("users")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error("Error fetching users:", error);
            toast.error("Error al cargar usuarios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [supabase]);

    const handleDeleteUser = async () => {
        if (!deleteModal) return;

        setProcessingId(deleteModal.id);

        try {
            const { data: { user: admin } } = await supabase.auth.getUser();
            if (!admin) throw new Error('No autenticado');

            const { data, error } = await supabase.rpc('delete_user_permanently', {
                p_user_id: deleteModal.id,
                p_admin_id: admin.id,
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.error);

            toast.success("Usuario eliminado correctamente");
            setDeleteModal(null);
            await fetchUsers();
        } catch (err) {
            console.error("Delete error:", err);
            toast.error(err instanceof Error ? err.message : 'Error al eliminar usuario');
        } finally {
            setProcessingId(null);
        }
    };

    const handleUpdateBalance = async () => {
        if (!balanceModal || !amount) return;

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount)) {
            toast.error("Monto inválido");
            return;
        }

        setProcessingId(balanceModal.id);

        try {
            const desc = description || "Ajuste manual de admin";

            const { data, error } = await supabase.rpc('add_driver_balance', {
                p_driver_id: balanceModal.id,
                p_amount: numAmount,
                p_description: desc
            });

            if (error) throw error;
            if (!data.success) throw new Error("Error en la operación");

            toast.success("Saldo actualizado correctamente");
            setBalanceModal(null);
            setAmount("");
            setDescription("");
            await fetchUsers();
        } catch (err) {
            console.error("Balance update error:", err);
            toast.error("Error al actualizar saldo. ¿El usuario es admin?");
        } finally {
            setProcessingId(null);
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "admin":
                return <Badge variant="danger">Admin</Badge>;
            case "taxi":
                return <Badge className="bg-blue-600 hover:bg-blue-700">Taxi</Badge>;
            case "mandadito":
                return <Badge className="bg-orange-500 hover:bg-orange-600">Mandadito</Badge>;
            default:
                return <Badge variant="secondary">Cliente</Badge>;
        }
    };

    const getKycBadge = (status: string, role: string) => {
        if (role === 'cliente' || role === 'admin') return <span className="text-muted-foreground text-xs">-</span>;

        switch (status) {
            case "approved":
                return <Badge variant="outline" className="text-green-600 border-green-600">Verificado</Badge>;
            case "pending":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>;
            case "rejected":
                return <Badge variant="destructive">Rechazado</Badge>;
            default:
                return <Badge variant="secondary">No Enviado</Badge>;
        }
    };

    const formatCurrency = (val?: number) => {
        if (val === undefined || val === null) return "$0.00";
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Usuarios Registrados ({users.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuario</TableHead>
                                        <TableHead>Rol</TableHead>
                                        <TableHead>Contacto</TableHead>
                                        <TableHead>Estado KYC</TableHead>
                                        <TableHead className="text-right">Saldo (Deuda)</TableHead>
                                        <TableHead>Registro</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{user.full_name}</span>
                                                    <span className="text-xs text-muted-foreground">{user.id.slice(0, 8)}...</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getRoleBadge(user.role)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                                        <span className="truncate max-w-[150px]" title={user.email}>{user.email}</span>
                                                    </div>
                                                    {user.phone && (
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                                            {user.phone}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getKycBadge(user.kyc_status, user.role)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(user.role === 'taxi' || user.role === 'mandadito') ? (
                                                    <div className={`font-mono text-sm font-bold ${(user.balance || 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                        {formatCurrency(user.balance || 0)}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(user.created_at), "dd MMM yy", { locale: es })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {(user.role === 'taxi' || user.role === 'mandadito') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setBalanceModal({ id: user.id, name: user.full_name, currentBalance: user.balance || 0 })}
                                                            title="Gestionar Saldo"
                                                            className="hover:text-green-600 hover:bg-green-50"
                                                        >
                                                            <Banknote className="h-4 w-4 text-green-600" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" onClick={() => setViewModal(user)} title="Ver detalles">
                                                        <Eye className="h-4 w-4 text-gray-500" />
                                                    </Button>
                                                    {user.role !== "admin" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setDeleteModal({ id: user.id, name: user.full_name })}
                                                            title="Eliminar permanentemente"
                                                            className="hover:text-red-600 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {users.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center p-8 text-muted-foreground">
                                                No se encontraron usuarios.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* View Details Modal */}
            {viewModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative shadow-lg">
                        <button
                            onClick={() => setViewModal(null)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-primary/10 rounded-full">
                                <User className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{viewModal.full_name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-300">{viewModal.email}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">ID</label>
                                    <p className="font-mono text-gray-900 dark:text-gray-100">{viewModal.id}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Rol</label>
                                    <div className="mt-1">{getRoleBadge(viewModal.role)}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Teléfono</label>
                                    <p className="text-gray-900 dark:text-gray-100">{viewModal.phone || "No registrado"}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Fecha Registro</label>
                                    <p className="text-gray-900 dark:text-gray-100">{format(new Date(viewModal.created_at), "PPP p", { locale: es })}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Estado KYC</label>
                                    <p className="capitalize text-gray-900 dark:text-gray-100">{viewModal.kyc_status?.replace('_', ' ') || "N/A"}</p>
                                </div>
                                {(viewModal.role === 'taxi' || viewModal.role === 'mandadito') && (
                                    <div className="col-span-2 mt-4 pt-4 border-t dark:border-gray-700">
                                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Saldo Actual</label>
                                        <p className={`text-xl font-bold ${((viewModal.balance || 0) < 0) ? 'text-red-500' : 'text-green-600'}`}>
                                            {formatCurrency(viewModal.balance)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {(viewModal.balance || 0) < 0 ? 'El conductor DEBE a la plataforma.' : 'La plataforma DEBE al conductor (o saldo a favor).'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <Button onClick={() => setViewModal(null)}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Balance Management Modal */}
            {balanceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 text-green-600">
                            <Banknote className="w-8 h-8" />
                            <h3 className="text-lg font-bold">Gestionar Saldo</h3>
                        </div>

                        <div className="mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Conductor</p>
                            <p className="font-bold text-lg dark:text-white">{balanceModal.name}</p>
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-sm text-gray-500">Saldo Actual:</span>
                                <span className={`font-mono font-bold ${balanceModal.currentBalance < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {formatCurrency(balanceModal.currentBalance)}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="amount">Monto a abonar/cargar</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                                    <Input
                                        id="amount"
                                        type="number"
                                        placeholder="0.00"
                                        className="pl-10"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Use números positivos para abonar (reducir deuda/dar crédito). <br />
                                    Use negativos para cargar (aumentar deuda).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="desc">Descripción</Label>
                                <Input
                                    id="desc"
                                    placeholder="Ej: Pago semanal en efectivo"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setBalanceModal(null);
                                    setAmount("");
                                    setDescription("");
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleUpdateBalance}
                                disabled={processingId === balanceModal.id || !amount}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {processingId === balanceModal.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Banknote className="w-4 h-4 mr-2" />
                                )}
                                Registrar Transacción
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertOctagon className="w-8 h-8" />
                            <h3 className="text-lg font-bold">¿Eliminar Usuario?</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                            Estás a punto de eliminar permanentemente a <strong>{deleteModal.name}</strong>.
                            <br /><br />
                            Esta acción borrará:
                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                <li>Cuenta de acceso y perfil</li>
                                <li>Historial de viajes y solicitudes</li>
                                <li>Vehículos asociados</li>
                                <li>Documentos KYC y Saldo</li>
                            </ul>
                            <br />
                            <span className="font-bold text-red-600">Esta acción es irreversible.</span>
                        </p>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setDeleteModal(null)}
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleDeleteUser}
                                disabled={processingId === deleteModal.id}
                                className="w-full sm:w-auto gap-2"
                            >
                                {processingId === deleteModal.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Eliminar Definitivamente
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
