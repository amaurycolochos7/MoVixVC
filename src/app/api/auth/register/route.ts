import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client with service role for bypassing RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, fullName, phone, role, vehicleData } = body;

        if (!email || !password || !fullName) {
            return NextResponse.json(
                { success: false, error: 'Email, contraseña y nombre son requeridos' },
                { status: 400 }
            );
        }

        // Check if OTP was verified for this email
        const { data: otpRecord, error: otpError } = await supabaseAdmin
            .from('otp_codes')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('type', 'registration')
            .eq('verified', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) {
            return NextResponse.json(
                { success: false, error: 'Email no verificado. Por favor verifica tu código OTP primero.' },
                { status: 400 }
            );
        }

        // Create user with admin API (auto-confirms email)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email.toLowerCase(),
            password: password,
            email_confirm: true, // Auto-confirm email since OTP was verified
            user_metadata: {
                full_name: fullName,
                phone: phone || null,
                role: role || 'cliente',
            }
        });

        if (authError) {
            console.error('Auth error:', authError);

            if (authError.message.includes('already been registered')) {
                return NextResponse.json(
                    { success: false, error: 'Este email ya está registrado' },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                { success: false, error: authError.message },
                { status: 400 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { success: false, error: 'No se pudo crear el usuario' },
                { status: 500 }
            );
        }

        const userId = authData.user.id;
        const isClient = role === 'cliente' || !role;

        // Create user profile in users table
        const { error: profileError } = await supabaseAdmin.from('users').insert({
            id: userId,
            email: email.toLowerCase(),
            full_name: fullName,
            phone: phone || null,
            role: role || 'cliente',
            // Clients are auto-approved, drivers need admin approval
            is_approved: isClient,
        });

        if (profileError) {
            console.error('Profile creation error:', profileError);
            // Don't fail the registration if profile creation fails
            // The trigger should handle this
        }

        // If driver, insert vehicle data
        if (role !== 'cliente' && vehicleData) {
            const { error: vehicleError } = await supabaseAdmin
                .from('driver_vehicles')
                .insert({
                    user_id: userId,
                    brand: vehicleData.brand,
                    model: vehicleData.model,
                    color: vehicleData.color,
                    plate_number: vehicleData.plate || null,
                    taxi_number: vehicleData.taxiNumber || null,
                });

            if (vehicleError) {
                console.error('Vehicle creation error:', vehicleError);
            }
        }

        // Clean up used OTP codes
        await supabaseAdmin
            .from('otp_codes')
            .delete()
            .eq('email', email.toLowerCase())
            .eq('type', 'registration');

        return NextResponse.json({
            success: true,
            message: role === 'cliente'
                ? '¡Cuenta creada exitosamente!'
                : 'Cuenta creada. Tu solicitud será revisada por un administrador.',
            userId: userId,
            requiresApproval: role !== 'cliente'
        });

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
