import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Load .env from project root in Main process
// Adjust path if strictly needed, but usually dotenv.config() works if started from root.
// In packaged app, we might need to handle this differently, but for now match user request.
dotenv.config();
// Ensure we are in the Main process
if (typeof process === 'undefined' || !process.env) {
    throw new Error('supabaseAdmin.ts must only be used in the Electron Main process.');
}
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase Admin Credentials. Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
}
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceRoleKey || '', // Use service_role only here
{
    auth: { persistSession: false }
});
