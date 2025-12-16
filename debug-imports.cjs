require('dotenv').config();
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

console.log('--- Environment Variables ---');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Present' : 'Missing');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Present' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing');
console.log('CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? 'Present' : 'Missing');

console.log('\n--- Testing Stripe Initialization ---');
try {
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  console.log(`Stripe Key length: ${stripeKey.length}`);
  const stripe = new Stripe(stripeKey);
  console.log('✅ Stripe initialized successfully');
} catch (error) {
  console.error('❌ Stripe initialization failed:', error.message);
}

console.log('\n--- Testing Supabase Initialization ---');
try {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`Supabase URL: ${url}`);
  console.log(`Supabase Key present: ${!!key}`);
  
  const supabase = createClient(url, key);
  console.log('✅ Supabase initialized successfully');
} catch (error) {
  console.error('❌ Supabase initialization failed:', error.message);
}