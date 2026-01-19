import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for admin operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate 6-digit OTP code
function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Create branded HTML email template
function createEmailTemplate(code: string, userName: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación MoVix</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse; background: linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FF4757 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(255, 107, 53, 0.3);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px;">
                            <h1 style="margin: 0; font-size: 42px; font-weight: 900; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.2);">
                                MoVix
                            </h1>
                            <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">
                                Tu aplicación de movilidad local
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td align="center" style="padding: 20px 30px;">
                            <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                                <p style="margin: 0 0 10px; font-size: 18px; color: #333; font-weight: 600;">
                                    ¡Hola${userName ? `, ${userName}` : ''}! 👋
                                </p>
                                <p style="margin: 0 0 25px; font-size: 15px; color: #666; line-height: 1.5;">
                                    Tu código de verificación para completar tu registro en MoVix es:
                                </p>
                                
                                <!-- OTP Code Box -->
                                <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); border-radius: 12px; padding: 20px 30px; margin: 0 0 25px;">
                                    <span style="font-size: 36px; font-weight: 900; color: white; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                        ${code}
                                    </span>
                                </div>
                                
                                <p style="margin: 0; font-size: 13px; color: #999; line-height: 1.5;">
                                    Este código expira en <strong style="color: #FF6B35;">10 minutos</strong>.<br>
                                    Si no solicitaste este código, ignora este mensaje.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 30px 40px;">
                            <p style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.7);">
                                © ${new Date().getFullYear()} MoVix - Todos los derechos reservados
                            </p>
                            <p style="margin: 8px 0 0; font-size: 11px; color: rgba(255,255,255,0.5);">
                                Este es un correo automático, por favor no respondas.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, name, type = 'registration' } = body;

        if (!email) {
            return NextResponse.json(
                { error: 'Email es requerido' },
                { status: 400 }
            );
        }

        // Generate OTP
        const code = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Delete any existing OTP for this email
        await supabaseAdmin
            .from('otp_codes')
            .delete()
            .eq('email', email.toLowerCase())
            .eq('type', type);

        // Store new OTP in database
        const { error: insertError } = await supabaseAdmin
            .from('otp_codes')
            .insert({
                email: email.toLowerCase(),
                code,
                type,
                expires_at: expiresAt.toISOString(),
                verified: false
            });

        if (insertError) {
            console.error('Error storing OTP:', insertError);
            return NextResponse.json(
                { error: 'Error al generar código de verificación' },
                { status: 500 }
            );
        }

        // Create email template
        const emailHtml = createEmailTemplate(code, name || '');

        // Send email using Resend
        if (process.env.RESEND_API_KEY) {
            console.log(`[OTP] Sending email to: ${email}`);

            try {
                const resendResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: process.env.RESEND_FROM_EMAIL || 'MoVix <onboarding@resend.dev>',
                        to: email,
                        subject: `${code} es tu código de verificación - MoVix`,
                        html: emailHtml,
                    }),
                });

                const resendData = await resendResponse.json();

                if (!resendResponse.ok) {
                    console.error('[OTP] Resend error (continuando en modo dev):', resendData);
                    // No fallar - continuar para mostrar devCode
                } else {
                    console.log('[OTP] Email sent successfully:', resendData);
                }
            } catch (emailError) {
                console.error('[OTP] Fetch error (continuando en modo dev):', emailError);
                // No fallar - continuar para mostrar devCode
            }
        } else {
            console.log(`[DEV] No RESEND_API_KEY - OTP for ${email}: ${code}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Código de verificación enviado',
            // Temporalmente en desarrollo - quitar cuando el dominio esté listo
            devCode: code
        });

    } catch (error) {
        console.error('OTP send error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
