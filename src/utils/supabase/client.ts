import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Client Debug:');
console.log('- URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('- Anon Key:', supabaseKey ? 'Set' : 'Missing');

export const createClient = () => {
  const client = createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
  
  console.log('🔧 Created Supabase browser client');
  return client;
};

// Export a default instance for convenience
export const supabase = createClient();