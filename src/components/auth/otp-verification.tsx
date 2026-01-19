"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface OTPVerificationProps {
    email: string;
    onVerified: () => void;
    onResend: () => Promise<void>;
    onBack: () => void;
}

export function OTPVerification({ email, onVerified, onResend, onBack }: OTPVerificationProps) {
    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [verified, setVerified] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    // Focus first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Only allow digits

        const newOtp = [...otp];
        newOtp[index] = value.slice(-1); // Only take last digit
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all digits entered
        if (newOtp.every(digit => digit !== "") && newOtp.join("").length === 6) {
            verifyOTP(newOtp.join(""));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);

        if (pastedData.length === 6) {
            const newOtp = pastedData.split("");
            setOtp(newOtp);
            verifyOTP(pastedData);
        }
    };

    const verifyOTP = async (code: string) => {
        setLoading(true);
        try {
            const response = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code, type: "registration" }),
            });

            const data = await response.json();

            if (data.valid) {
                setVerified(true);
                toast.success("¡Email verificado exitosamente!");
                setTimeout(() => {
                    onVerified();
                }, 1500);
            } else {
                toast.error(data.error || "Código inválido");
                setOtp(new Array(6).fill(""));
                inputRefs.current[0]?.focus();
            }
        } catch (error) {
            toast.error("Error al verificar. Intenta de nuevo.");
            setOtp(new Array(6).fill(""));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;

        setResending(true);
        try {
            await onResend();
            toast.success("Nuevo código enviado a tu email");
            setCountdown(60);
            setCanResend(false);
            setOtp(new Array(6).fill(""));
            inputRefs.current[0]?.focus();
        } catch (error) {
            toast.error("Error al reenviar código");
        } finally {
            setResending(false);
        }
    };

    if (verified) {
        return (
            <Card className="w-full max-w-md">
                <CardContent className="pt-8 pb-8">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-[bounce_1s_ease-in-out]">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-600 mb-2">¡Verificado!</h2>
                        <p className="text-muted-foreground">Tu email ha sido verificado correctamente</p>
                        <p className="text-sm text-muted-foreground mt-2">Creando tu cuenta...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl">Verifica tu email</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                    Enviamos un código de 6 dígitos a:
                </p>
                <p className="text-sm font-semibold text-primary">{email}</p>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* OTP Input */}
                    <div className="flex justify-center gap-2" onPaste={handlePaste}>
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { inputRefs.current[index] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-10 h-12 text-center text-xl font-bold border-2 rounded-lg 
                                          focus:border-orange-500 focus:ring-2 focus:ring-orange-200 
                                          outline-none transition-all disabled:opacity-50
                                          bg-gray-50 hover:bg-white"
                                disabled={loading}
                            />
                        ))}
                    </div>

                    {/* Loading indicator */}
                    {loading && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Verificando...</span>
                        </div>
                    )}

                    {/* Resend section */}
                    <div className="text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                            ¿No recibiste el código?
                        </p>
                        {canResend ? (
                            <Button
                                variant="ghost"
                                onClick={handleResend}
                                disabled={resending}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                                {resending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Reenviando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Reenviar código
                                    </>
                                )}
                            </Button>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Reenviar en <span className="font-semibold text-orange-600">{countdown}s</span>
                            </p>
                        )}
                    </div>

                    {/* Back button */}
                    <Button
                        variant="outline"
                        onClick={onBack}
                        className="w-full"
                        disabled={loading}
                    >
                        ← Volver al registro
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
