/**
 * Unified error parsing for Supabase/Fetch errors.
 * Returns user-friendly messages while logging technical details.
 */

export interface ParsedError {
    message: string;
    retryable: boolean;
}

export function parseSupabaseError(error: unknown): ParsedError {
    // Default
    let message = "Error desconocido";
    let retryable = true;

    // Log technical details
    console.error("[Supabase Error]:", error);

    if (!error) {
        return { message, retryable };
    }

    // Handle string errors
    if (typeof error === "string") {
        if (error.toLowerCase().includes("network") || error.toLowerCase().includes("fetch")) {
            return { message: "Error de conexión. Verifica tu internet.", retryable: true };
        }
        return { message: error, retryable: true };
    }

    // Handle Error objects
    const err = error as Record<string, unknown>;

    // Network / Fetch errors
    if (
        err.message?.toString().toLowerCase().includes("network") ||
        err.message?.toString().toLowerCase().includes("fetch") ||
        err.message?.toString().toLowerCase().includes("failed to fetch") ||
        err.code === "NETWORK_ERROR"
    ) {
        return { message: "Error de conexión. Verifica tu internet.", retryable: true };
    }

    // RLS / Auth errors (401, 403, PGRST codes)
    if (
        err.code === "PGRST301" ||
        err.code === "42501" || // RLS violation
        err.code === "401" ||
        err.code === "403" ||
        err.message?.toString().includes("policy") ||
        err.message?.toString().includes("permission denied") ||
        err.message?.toString().toLowerCase().includes("not authorized")
    ) {
        return { message: "No autorizado. Tu cuenta puede estar en revisión.", retryable: false };
    }

    // FK constraint (23503) - often means record doesn't exist
    if (err.code === "23503") {
        return { message: "Registro no encontrado o no válido.", retryable: false };
    }

    // Request expired (custom RPC error)
    if (
        err.message?.toString().includes("REQUEST_EXPIRED") ||
        err.message?.toString().includes("expirada") ||
        err.message?.toString().includes("expired")
    ) {
        return { message: "Solicitud expirada. Intenta con otra.", retryable: false };
    }

    // Authentication required
    if (
        err.message?.toString().includes("No autenticado") ||
        err.message?.toString().includes("not authenticated") ||
        err.code === "AUTH_REQUIRED"
    ) {
        return { message: "Sesión expirada. Inicia sesión nuevamente.", retryable: false };
    }

    // Generic Supabase error with message
    if (err.message && typeof err.message === "string") {
        // Don't expose technical messages, use generic
        return { message: "Error al procesar la solicitud.", retryable: true };
    }

    return { message, retryable };
}
