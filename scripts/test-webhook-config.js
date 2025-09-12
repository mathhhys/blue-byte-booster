// Quick test to verify webhook configuration
console.log('🔍 Checking webhook environment configuration...\n');

console.log('📋 Environment Variables:');
console.log('CLERK_WEBHOOK_SIGNING_SECRET:', process.env.CLERK_WEBHOOK_SIGNING_SECRET ? '✅ Set' : '❌ Missing');
console.log('CLERK_WEBHOOK_SECRET:', process.env.CLERK_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

console.log('\n🎯 What you need to do:');
console.log('1. Go to Clerk Dashboard → Webhooks');
console.log('2. Add endpoint: https://www.softcodes.ai/api/clerk/webhooks');
console.log('3. Copy the webhook signing secret (starts with whsec_)');
console.log('4. Add it as CLERK_WEBHOOK_SIGNING_SECRET in your environment');
console.log('5. Redeploy your app');
console.log('\n✅ Then your webhooks will work with real Clerk events!');