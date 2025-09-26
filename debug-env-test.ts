// Temporary debug file to check environment variables
console.log('🔍 Environment Variables Debug:');
console.log('import.meta.env:', import.meta.env);
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('All VITE_ prefixed variables:');
Object.keys(import.meta.env).forEach(key => {
  if (key.startsWith('VITE_')) {
    console.log(`- ${key}:`, import.meta.env[key]);
  }
});