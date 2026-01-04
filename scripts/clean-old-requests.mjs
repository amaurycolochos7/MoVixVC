// Script para limpiar solicitudes antiguas con estado "pending"
// Ejecuta: node scripts/clean-old-requests.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const supabase = createClient(
    envVars.NEXT_PUBLIC_SUPABASE_URL,
    envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
        if (data && data.length > 0) {
            console.log('Solicitudes canceladas:');
            data.forEach(req => {
                console.log(`  - ${req.id} (creada: ${req.created_at})`);
            });
        }
    } catch (err) {
        console.error('❌ Error:', err);
    }
}

cleanOldPendingRequests();
