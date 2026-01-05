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
import { Loader2, Mail, Phone, Calendar, User } from "lucide-react";

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
    const supabase = createClient();

    useEffect(() => {
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
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [supabase]);

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "admin":
                return <Badge variant="destructive">Admin</Badge>;
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
                                        <TableHead>Registro</TableHead>
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
                                                        {user.email}
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
                                                    {format(new Date(user.created_at), "dd MMM yyyy", { locale: es })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {users.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center p-8 text-muted-foreground">
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
        </div>
    );
}
