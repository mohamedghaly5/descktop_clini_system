import { createClient } from '@supabase/supabase-js';
// MAIN PROCESS ONLY: Use Service Role Key for Admin Access
// This runs after env-loader.ts has populated process.env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase Client (Main): Missing Environment Variables.', {
        url: !!supabaseUrl,
        key: !!supabaseKey
    });
}
else {
    console.log('✅ Supabase Client (Main): Initialized with Service Role');
    // Avoid logging the actual key for security
}
export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
});
