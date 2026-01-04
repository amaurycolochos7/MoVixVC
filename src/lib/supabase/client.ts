// src/lib/supabase/client.ts
// Browser Supabase client

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://akfafxjktmznqfvvzcbc.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZmFmeGprdG16bnFmdnZ6Y2JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNDI0NjYsImV4cCI6MjA4MjYxODQ2Nn0.nMj3saI4yt5r28OJpZ9vRoihvmGs5ZGvG7PHESZEcl4';

export function createClient() {
    return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

