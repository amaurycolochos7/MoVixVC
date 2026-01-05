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
import { Loader2, Mail, Phone, Calendar, User, Trash2, Eye, X, AlertOctagon } from "lucide-react";
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
}

export default function AdminUsuariosPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);
    const [viewModal, setViewModal] = useState<UserData | null>(null);

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
        if (role === 'cliente' || role === 'admin') return null;

        switch (status) {
            case "approved":
                return <Badge variant="outline" className="text-green-600 border-green-600">Verificado</Badge>;
            case "pending":
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pendiente</Badge>;
            case "rejected":
                return <Badge variant="outline" className="text-red-600 border-red-600">Rechazado</Badge>;
            default:
                return <Badge variant="outline" className="text-gray-500 border-gray-500">Sin enviar</Badge>;
        }
    };

    return (
        <div className="space-y-6 relative">
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>

            <Card>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Usuarios Registrados ({users.length})</span>
                    </CardTitle>
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
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(user.created_at), "dd MMM yy", { locale: es })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
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
                                            <TableCell colSpan={6} className="text-center p-8 text-muted-foreground">
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
            {
                viewModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 relative">
                            <button
                                onClick={() => setViewModal(null)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-primary/10 rounded-full">
                                    <User className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{viewModal.full_name}</h3>
                                    <p className="text-sm text-muted-foreground">{viewModal.email}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="text-xs text-muted-foreground">ID</label>
                                        <p className="font-mono">{viewModal.id}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Rol</label>
                                        <div className="mt-1">{getRoleBadge(viewModal.role)}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Teléfono</label>
                                        <p>{viewModal.phone || "No registrado"}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Fecha Registro</label>
                                        <p>{format(new Date(viewModal.created_at), "PPP p", { locale: es })}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Estado KYC</label>
                                        <p className="capitalize">{viewModal.kyc_status?.replace('_', ' ') || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <Button onClick={() => setViewModal(null)}>
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {
                deleteModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
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
                                    <li>Documentos KYC</li>
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
                                    className="gap-2 w-full sm:w-auto"
                                >
                                    {processingId === deleteModal.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    Eliminar
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
