/**
 * Script to create admin user in Supabase
 * This should be run once to setup the admin account
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ADMIN_EMAIL = 'amaury.colochos7@gmail.com';
const ADMIN_PASSWORD = 'Gordillo94*';
const ADMIN_NAME = 'Amaury Colochos (Admin)';

async function createAdminUser() {
    // Create Supabase admin client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log('🔧 Creating admin user...');

    try {
        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: ADMIN_NAME,
                role: 'admin'
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('⚠️  User already exists in auth. Updating profile...');

                // Get existing user
                const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
                if (listError) throw listError;

                const existingUser = users?.find(u => u.email === ADMIN_EMAIL);
                if (!existingUser) throw new Error('User exists but could not be found');

                // Update user in users table
                const { error: updateError } = await supabase
                    .from('users')
                    .upsert({
                        id: existingUser.id,
                        email: ADMIN_EMAIL,
                        full_name: ADMIN_NAME,
                        role: 'admin',
                        is_active: true,
                        is_available: false
                    });

                if (updateError) throw updateError;

                console.log('✅ Admin profile updated successfully!');
                console.log(`📧 Email: ${ADMIN_EMAIL}`);
                console.log(`🆔 User ID: ${existingUser.id}`);
                return;
            }
            throw authError;
        }

        console.log('✅ Auth user created successfully!');
        console.log(`📧 Email: ${ADMIN_EMAIL}`);
        console.log(`🆔 User ID: ${authData.user?.id}`);

        // Create profile in users table
        const { error: profileError } = await supabase
            .from('users')
            .insert({
                id: authData.user!.id,
                email: ADMIN_EMAIL,
                full_name: ADMIN_NAME,
                role: 'admin',
                is_active: true,
                is_available: false
            });

        if (profileError) {
            console.error('❌ Error creating profile:', profileError);
            throw profileError;
        }

        console.log('✅ Admin profile created successfully!');
        console.log('\n🎉 Admin user setup complete!');
        console.log(`\nLogin credentials:`);
        console.log(`Email: ${ADMIN_EMAIL}`);
        console.log(`Password: ${ADMIN_PASSWORD}`);
        console.log(`\nAccess admin panel at: /admin`);

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        throw error;
    }
}

// Run the script
createAdminUser()
    .then(() => {
        console.log('\n✨ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });
