import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for admin operations
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, code, type = 'registration' } = body;

        if (!email || !code) {
            return NextResponse.json(
                { error: 'Email y código son requeridos' },
                { status: 400 }
            );
        }

        // Find the OTP code
        const { data: otpRecord, error: findError } = await supabaseAdmin
            .from('otp_codes')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('code', code)
            .eq('type', type)
            .eq('verified', false)
            .single();

        if (findError || !otpRecord) {
            return NextResponse.json(
                { error: 'Código inválido o expirado', valid: false },
                { status: 400 }
            );
        }

        // Check if expired
        const now = new Date();
        const expiresAt = new Date(otpRecord.expires_at);

        if (now > expiresAt) {
            // Delete expired code
            await supabaseAdmin
                .from('otp_codes')
                .delete()
                .eq('id', otpRecord.id);

            return NextResponse.json(
                { error: 'El código ha expirado. Solicita uno nuevo.', valid: false, expired: true },
                { status: 400 }
            );
        }

        // Mark as verified
        const { error: updateError } = await supabaseAdmin
            .from('otp_codes')
            .update({
                verified: true,
                used_at: new Date().toISOString()
            })
            .eq('id', otpRecord.id);

        if (updateError) {
            console.error('Error updating OTP:', updateError);
            return NextResponse.json(
                { error: 'Error al verificar código' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            valid: true,
            message: 'Código verificado correctamente'
        });

    } catch (error) {
        console.error('OTP verify error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
