import { createClient } from '@supabase/supabase-js';
export const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = supabaseURL && supabasePublishableKey ? createClient(supabaseURL, supabasePublishableKey, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } }) : null;
