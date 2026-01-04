// Script para limpiar solicitudes antiguas con estado "pending"
// Ejecuta: node scripts/clean-old-requests.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanOldPendingRequests() {
    console.log('🧹 Limpiando solicitudes antiguas...');

    // Calcular fecha de hace 1 hora
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    try {
        // Actualizar solicitudes "pending" antiguas a "cancelled"
        const { data, error } = await supabase
            .from('service_requests')
            .update({ status: 'cancelled', cancellation_reason: 'Expirado automáticamente' })
            .eq('status', 'pending')
            .lt('created_at', oneHourAgo.toISOString())
            .select();

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        console.log(`✅ ${data?.length || 0} solicitudes antiguas canceladas`);
        console.log(data);
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

cleanOldPendingRequests();
