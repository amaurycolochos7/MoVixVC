import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars if running locally with dotenv (optional if running via valid environment)
// But since we are running via tsx/node, we can just hardcode for this script or read envs.
// We'll use the arguments passed or hardcode the user provided tokens for this run.

const SUPABASE_URL = "https://akfafxjktmznqfvvzcbc.supabase.co";
const SERVICE_KEY = "sb_secret_Y3e-HYxTpKLFNdIfo_9T0g_85VYbpaQ"; // User provided secret

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    console.log("🌱 Starting seed...");

    const users = [
        { email: "admin@movix.com", password: "password123", role: "admin", name: "Admin User", available: false },
        { email: "cliente@movix.com", password: "password123", role: "cliente", name: "Cliente Test", available: false },
        { email: "taxi@movix.com", password: "password123", role: "taxi", name: "Juan Perez (Taxi)", available: true },
        { email: "mandadito@movix.com", password: "password123", role: "mandadito", name: "Maria Moto (Mandadito)", available: true },
    ];

    for (const u of users) {
        console.log(`Processing ${u.email}...`);

        // 1. Create Auth User
        // We use admin.createUser which bypasses email confirmation usually
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true
        });

        let userId = authUser?.user?.id;

        if (authError) {
            if (authError.message.includes("already registered")) {
                console.log(`  User ${u.email} exists in Auth.`);
                // Try to get user ID if exists? 
                // We can't easily get ID by email with admin API without listing users, 
                // but for seed simple restart is better or just ignore if public profile checks valid.
                // Let's list users to find the ID.
                const { data: listUsers } = await supabase.auth.admin.listUsers();
                const existing = listUsers?.users.find(x => x.email === u.email);
                userId = existing?.id;
            } else {
                console.error(`  Error creating auth user: ${authError.message}`);
                continue;
            }
        }

        if (!userId) {
            console.error("  Could not resolve User ID.");
            continue;
        }

        // 2. Upsert Public Profile
        const { error: profileError } = await supabase.from('users').upsert({
            id: userId,
            email: u.email,
            full_name: u.name,
            role: u.role,
            is_available: u.available,
            // Default location for drivers so they show on map
            ...(u.available ? { current_lat: 19.432608, current_lng: -99.133209 } : {})
        });

        if (profileError) {
            console.error(`  Error upserting profile: ${profileError.message}`);
        } else {
            console.log(`  ✅ Profile synced for ${u.email}`);
        }
    }

    console.log("🏁 Seed complete.");
}

main();
