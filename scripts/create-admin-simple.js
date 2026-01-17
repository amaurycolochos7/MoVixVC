/**
 * Simple script to create admin user via Supabase CLI
 * Run with: node scripts/create-admin-simple.js
 */

console.log(`
╔═══════════════════════════════════════════════════════════╗
║         MoVix - Admin User Creation Instructions          ║
╔═══════════════════════════════════════════════════════════╗

To create the admin user, you have two options:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OPTION 1: Via Supabase Dashboard (RECOMMENDED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to: Authentication → Users
4. Click "Add user" → "Create new user"
5. Enter:
   Email: amaury.colochos7@gmail.com
   Password: Gordillo94*
   ✅ Auto Confirm User: YES
6. Click "Create user"
7. Copy the User ID from the users table
8. Go to: Database → SQL Editor
9. Run this SQL:

   UPDATE users 
   SET role = 'admin', 
       full_name = 'Amaury Colochos (Admin)',
       is_active = TRUE
   WHERE email = 'amaury.colochos7@gmail.com';

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ OPTION 2: Via Supabase CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If using Supabase locally:

1. Run migration:
   npx supabase db push

2. Create user via SQL:
   Run the migration file: supabase/migrations/021_add_admin_user.sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 Login Credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 Email:    amaury.colochos7@gmail.com
🔑 Password: Gordillo94*
👤 Role:     admin
🌐 Panel:    http://localhost:3000/admin

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After creating the user, you can login at:
http://localhost:3000/login

Your user will have 'admin' role and access to the admin panel.

╚═══════════════════════════════════════════════════════════╝
`);
