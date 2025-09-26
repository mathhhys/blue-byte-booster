import { createBrowserClient } from "@supabase/ssr";

// Handle environment variables properly for both Vite and Next.js
const getEnvVar = (name: string): string | undefined => {
  if (typeof window !== 'undefined') {
    // Browser environment - use Vite env vars
    return (window as any).__VITE_ENV__?.[name] ||
           (import.meta as any).env?.[name] ||
           undefined;
  }
  // Server environment - use process.env
  return process.env[name];
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') ||
                   getEnvVar('NEXT_PUBLIC_SUPABASE_URL') ||
                   process.env.VITE_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY') ||
                   getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
                   process.env.VITE_SUPABASE_ANON_KEY ||
                   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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